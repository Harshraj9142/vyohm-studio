import type { Data } from "@puckeditor/core";
import { AiError, toAiError } from "@/lib/ai/claude";
import { revisePage } from "@/lib/ai/revise";
import { findPageProblem } from "@/lib/page-schema";
import type { Scope } from "@/lib/revise/apply";

/**
 * POST /api/revise
 * body: { instruction, scope: { kind: "page" } | { kind: "element", id }, page, viewport }
 * Returns { summary, operations } — a list of small edits, NOT a new page.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

    const instruction = typeof body?.instruction === "string" ? body.instruction.trim() : "";
    if (instruction.length < 2) throw new AiError("Please type what you want to change.", 400);
    if (instruction.length > 1000) throw new AiError("Please keep the instruction under 1,000 characters.", 400);

    const rawScope = body?.scope as { kind?: unknown; id?: unknown } | undefined;
    const scope: Scope | null =
      rawScope?.kind === "page"
        ? { kind: "page" }
        : rawScope?.kind === "element" && typeof rawScope.id === "string"
          ? { kind: "element", id: rawScope.id }
          : null;
    if (!scope) throw new AiError("Invalid edit scope.", 400);

    const problem = findPageProblem(body?.page);
    if (problem) throw new AiError(`The current page could not be read (${problem}).`, 400);

    const viewport = body?.viewport === "mobile" ? "mobile" : "desktop";
    const result = await revisePage({ instruction, scope, page: body!.page as Data, viewport });
    console.log(
      `[ai] revision with ${result.model} in ${result.ms} ms, ${result.operations.length} operation(s), attempt ${result.attempts}`,
    );
    return Response.json({ summary: result.summary, operations: result.operations });
  } catch (error) {
    const aiError = toAiError(error);
    return Response.json({ error: aiError.message }, { status: aiError.status });
  }
}
