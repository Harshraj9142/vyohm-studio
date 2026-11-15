import type Anthropic from "@anthropic-ai/sdk";
import type { Data } from "@puckeditor/core";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { applyOperations, describe, type Scope } from "@/lib/revise/apply";
import { walkElements } from "@/lib/page-tree";
import { AiError, effort, fallbackOptions, getClient, MODEL, REVISE_TIMEOUT_MS } from "./claude";
import { REVISE_SYSTEM_PROMPT, reviseUserPrompt } from "./prompts";
import { RevisionSchema, type Operation } from "./revise-schema";

/**
 * Ask Claude for a targeted edit.
 * Returns operations (not a page). They are test-applied to the page we were
 * sent; if that fails, Claude gets one chance to correct itself.
 */
export async function revisePage(input: {
  instruction: string;
  scope: Scope;
  page: Data;
  viewport: "mobile" | "desktop";
}): Promise<{ summary: string; operations: Operation[]; model: string; ms: number; attempts: number }> {
  const client = getClient();
  const started = Date.now();

  let scopeText = "The whole page.";
  if (input.scope.kind === "element") {
    const id = input.scope.id;
    let selected: { type: string; props: Record<string, unknown> } | null = null;
    walkElements(input.page, (node) => {
      if (node.props.id === id) selected = node;
    });
    if (!selected) throw new AiError("The selected element was not found on the page.", 400);
    scopeText = `Only the selected element: id "${id}" (${describe(selected)}). Operate only on this element or elements inside it. Do not change anything else.`;
  }

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: reviseUserPrompt({
        pageJson: JSON.stringify(input.page.root.props),
        scopeText,
        viewport: input.viewport,
        instruction: input.instruction,
      }),
    },
  ];

  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: REVISE_SYSTEM_PROMPT,
      messages,
      output_config: {
        effort: effort("low"), // small, targeted edits: favour speed
        format: betaZodOutputFormat(RevisionSchema),
      },
      ...fallbackOptions(),
    }, { timeout: REVISE_TIMEOUT_MS, maxRetries: 1 });

    if (response.stop_reason === "refusal") {
      throw new AiError("Claude declined this edit. Try rewording the instruction.", 422);
    }
    if (response.stop_reason === "max_tokens") {
      throw new AiError("Claude's answer was cut off. Try a smaller change.", 502);
    }
    const revision = response.parsed_output;
    if (!revision) throw new AiError("Claude returned an answer we could not read. Nothing was changed.", 502);

    const check = applyOperations(input.page, revision.operations, input.scope);
    if (check.ok) {
      return {
        summary: revision.summary,
        operations: revision.operations,
        model: response.model,
        ms: Date.now() - started,
        attempts: attempt,
      };
    }

    console.warn(`[ai] revision attempt ${attempt} could not be applied: ${check.error}`);
    if (attempt === 2) {
      throw new AiError(`The AI's change could not be applied: ${check.error} Nothing was changed.`, 422);
    }
    // Give Claude the exact problem and one chance to fix it.
    messages.push(
      { role: "assistant", content: response.content },
      {
        role: "user",
        content: `Those operations cannot be applied: ${check.error}\nReturn corrected operations that follow the rules and the scope.`,
      },
    );
  }
  throw new AiError("Unexpected error while revising.", 500);
}
