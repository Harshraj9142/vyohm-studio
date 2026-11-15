import { generatePage } from "@/lib/ai/generate";
import { AiError, toAiError } from "@/lib/ai/claude";

/**
 * POST /api/generate   body: { prompt: string }
 * Returns { data } (a validated page) or { error } with a readable message.
 *
 * Runs on the server, so the Claude API key stays secret.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { prompt?: unknown } | null;
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    if (prompt.length < 10) {
      throw new AiError("Please describe your business in at least one sentence.", 400);
    }
    if (prompt.length > 3000) {
      throw new AiError("That description is too long. Please keep it under 3,000 characters.", 400);
    }

    const result = await generatePage(prompt);
    console.log(`[ai] generated page with ${result.model} in ${result.ms} ms`);
    return Response.json(result);
  } catch (error) {
    const aiError = toAiError(error);
    return Response.json({ error: aiError.message }, { status: aiError.status });
  }
}
