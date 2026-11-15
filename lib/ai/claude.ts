import Anthropic from "@anthropic-ai/sdk";

/**
 * Shared Claude API setup. Server-only: this file reads the secret API key,
 * so it must only be imported from route handlers (app/api/...), never from
 * components. The key never reaches the browser.
 */

export const MODEL = process.env.ANTHROPIC_MODEL?.trim() || "claude-opus-5-5";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";
const EFFORTS: Effort[] = ["low", "medium", "high", "xhigh", "max"];
/** How hard Claude thinks. Lower = faster replies. Override with ANTHROPIC_EFFORT in .env. */
export function effort(fallback: Effort): Effort {
  const fromEnv = process.env.ANTHROPIC_EFFORT?.trim() as Effort | undefined;
  return fromEnv && EFFORTS.includes(fromEnv) ? fromEnv : fallback;
}

/**
 * If Claude's safety filter declines a request, the API can automatically retry
 * on another model ("server-side fallback"). Only some models support it.
 */
export function fallbackOptions() {
  const supported = /^claude-(opus-5|opus-5-5|sonnet-5-5|fable-5)/.test(MODEL);
  return supported
    ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
    : {};
}

/**
 * Time limits per AI request (the SDK default is 10 minutes, far too long for a person
 * waiting in the editor). One automatic retry on network errors, rate limits or overload.
 */
export const GENERATE_TIMEOUT_MS = 180_000;
export const REVISE_TIMEOUT_MS = 90_000;

/** An error with a message that is safe and useful to show the user. */
export class AiError extends Error {
  constructor(
    message: string,
    public status = 502,
  ) {
    super(message);
  }
}

export function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AiError(
      "The server has no ANTHROPIC_API_KEY. Add it to .env (see .env.example) and restart.",
      500,
    );
  }
  return new Anthropic();
}

/** Turn any error into a short message for the user (details go to the server log). */
export function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error;
  console.error("[ai] request failed:", error);
  if (error instanceof Anthropic.AuthenticationError) {
    return new AiError("The Claude API key was rejected. Check ANTHROPIC_API_KEY in .env.", 500);
  }
  if (error instanceof Anthropic.PermissionDeniedError) {
    return new AiError("This API key does not have access to the selected model.", 500);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AiError("Claude is busy (rate limit). Please wait a moment and try again.", 429);
  }
  if (error instanceof Anthropic.BadRequestError) {
    return new AiError(`Claude rejected the request: ${error.message}`, 502);
  }
  if (error instanceof Anthropic.APIConnectionTimeoutError) {
    return new AiError("Claude took too long to answer. Please try again in a moment.", 504);
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return new AiError("Could not reach the Claude API. Check your internet connection.", 503);
  }
  if (error instanceof Anthropic.APIError) {
    return new AiError(`Claude API error (${error.status ?? "unknown"}). Please try again.`, 502);
  }
  // In development, show the underlying cause to make debugging easier.
  const detail =
    process.env.NODE_ENV === "development" && error instanceof Error ? ` (${error.message})` : "";
  return new AiError(`Something went wrong while talking to Claude. Please try again.${detail}`, 500);
}
