import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * GET /api/export-template
 * Returns the source files every exported project needs: the Next.js template
 * (export-template/) and the shared site components (components/site/).
 *
 * The browser adds the page data and uploaded images, then zips everything.
 *
 * Security: files come from a fixed ALLOWLIST only, so secrets such as .env
 * can never end up in an export.
 */

const TEMPLATE_FILES = [
  ".gitignore",
  ".nvmrc",
  "README.md",
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "next.config.ts",
  "app/layout.tsx",
  "app/page.tsx",
  "app/globals.css",
];

const SHARED_SITE_FILES = ["blocks.tsx", "model.ts", "style.ts", "assets.ts", "render.tsx", "site.css"];

export async function GET() {
  const root = process.cwd();
  try {
    const files: Record<string, string> = {};
    for (const file of TEMPLATE_FILES) {
      files[file] = await readFile(path.join(root, "export-template", file), "utf8");
    }
    for (const file of SHARED_SITE_FILES) {
      files[`components/site/${file}`] = await readFile(path.join(root, "components", "site", file), "utf8");
    }
    return Response.json({ files });
  } catch (error) {
    console.error("[export] could not read template files", error);
    return Response.json({ error: "Could not read the export template on the server." }, { status: 500 });
  }
}
