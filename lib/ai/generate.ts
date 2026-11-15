import type { Data } from "@puckeditor/core";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { findPageProblem } from "@/lib/page-schema";
import { AiError, effort, fallbackOptions, GENERATE_REQUEST, getClient, MODEL } from "./claude";
import { generatedToPage } from "./convert";
import { GeneratedPageSchema } from "./generate-schema";
import { GENERATE_SYSTEM_PROMPT, generateUserPrompt } from "./prompts";

/**
 * Generate a whole new page from a business brief.
 * Flow: Claude (structured JSON) -> convert (ids, defaults, clamping) -> strict validation.
 */
export async function generatePage(brief: string): Promise<{ data: Data; model: string; ms: number }> {
  const client = getClient();
  const started = Date.now();

  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: GENERATE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: generateUserPrompt(brief) }],
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

  return { data, model: response.model, ms: Date.now() - started };
}
