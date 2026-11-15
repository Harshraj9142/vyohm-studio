import type { Data } from "@puckeditor/core";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { findPageProblem } from "@/lib/page-schema";
import { AiError, effort, fallbackOptions, GENERATE_REQUEST, getClient, MODEL } from "./claude";
import { cleanText, generatedToPage } from "./convert";
import { DIRECTION_COUNT, GeneratedPageSchema } from "./generate-schema";
import { GENERATE_SYSTEM_PROMPT, generateUserPrompt } from "./prompts";

/** The design direction Claude built (shown in logs; handy for explaining a result). */
export type DesignInfo = { number: number; name: string; summary: string };

/**
 * Generate a whole new page from a business brief.
 * Flow: Claude (structured JSON) -> convert (ids, defaults, clamping) -> strict validation.
 *
 * Variety: Claude first proposes DIRECTION_COUNT different design directions for the
 * brief, then builds the one whose number we pick at random here (never the same number
 * twice in a row). So the same brief can produce clearly different pages, and "Try again"
 * gives a new look.
 */
let previousDirection = 0;

/** A random direction number, never the same as the previous generation's, so "Try again" always looks different. */
function pickDirection(): number {
  let number: number;
  do number = 1 + Math.floor(Math.random() * DIRECTION_COUNT);
  while (number === previousDirection);
  previousDirection = number;
  return number;
}

export async function generatePage(
  brief: string,
): Promise<{ data: Data; model: string; ms: number; design: DesignInfo }> {
  const client = getClient();
  const started = Date.now();
  const directionNumber = pickDirection();

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: GENERATE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: generateUserPrompt(brief, directionNumber) }],
    output_config: {
      effort: effort("medium"),
      format: betaZodOutputFormat(GeneratedPageSchema),
    },
    ...fallbackOptions(),
  }, GENERATE_REQUEST);

  if (response.stop_reason === "refusal") {
    throw new AiError("Claude declined to generate this page. Try rewording the brief.", 422);
  }
  if (response.stop_reason === "max_tokens") {
    throw new AiError("Claude's answer was cut off (too long). Try a shorter brief.", 502);
  }
  const generated = response.parsed_output;
  if (!generated) {
    throw new AiError("Claude returned an answer we could not read. Nothing was changed.", 502);
  }

  const data = generatedToPage(generated);
  const problem = findPageProblem(data);
  if (problem) {
    console.error("[ai] generated page failed validation:", problem);
    throw new AiError(`The generated page failed validation (${problem}). Nothing was changed.`, 502);
  }
  if ((data.root.props as { content: unknown[] }).content.length === 0) {
    throw new AiError("Claude returned a page with no sections. Please try again.", 502);
  }

  // The line Claude wrote for the chosen direction, e.g. "3. Quiet gallery | ... ".
  const line = generated.designDirections
    .split("\n")
    .find((text) => text.trim().startsWith(`${directionNumber}.`));
  const summary = cleanText(line?.trim().slice(`${directionNumber}.`.length), 400);
  const design: DesignInfo = { number: directionNumber, name: summary.split("|")[0].trim(), summary };

  return { data, model: response.model, ms: Date.now() - started, design };
}
