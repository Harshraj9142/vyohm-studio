"use client";

import JSZip from "jszip";
import type { Data } from "@puckeditor/core";
import { findPageProblem } from "@/lib/page-schema";
import { walkElements } from "@/lib/page-tree";
import { getAllAssets } from "@/lib/storage";

/**
 * Builds website.zip — a standalone Next.js project — in the browser.
 *
 *  1. Validate the page.
 *  2. Fetch the template + shared components from /api/export-template.
 *  3. Copy the page and rewrite every uploaded image "asset:<id>" to a real
 *     file path "/assets/<id>.png", adding the image file from IndexedDB.
 *  4. Zip: template files + data/page.json + public/assets/*.
 */

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

export type ExportResult = { blob: Blob; imageCount: number; missingImages: number };

export async function buildWebsiteZip(data: Data): Promise<ExportResult> {
  const problem = findPageProblem(data);
  if (problem) throw new Error(`The page has a problem and cannot be exported (${problem}).`);

  const response = await fetch("/api/export-template");
  const template = (await response.json().catch(() => null)) as { files?: Record<string, string>; error?: string } | null;
  if (!response.ok || !template?.files) {
    throw new Error(template?.error ?? `Could not load the export template (HTTP ${response.status}).`);
  }

  // Work on a copy so the editor's page is never changed by exporting.
  const page = structuredClone(data);
  const stored = new Map((await getAllAssets()).map((asset) => [asset.id, asset]));
  const images = new Map<string, { file: string; blob: Blob }>();
  let missingImages = 0;

  walkElements(page, (node) => {
    const src = node.props.src;
    if (node.type !== "Image" || typeof src !== "string" || !src.startsWith("asset:")) return;
    const id = src.slice("asset:".length);
    const asset = stored.get(id);
    if (!asset) {
      node.props.src = "placeholder:Missing image";
      missingImages++;
      return;
    }
    const file = `${id}.${EXTENSIONS[asset.type] ?? "img"}`;
    images.set(id, { file, blob: asset.blob });
    node.props.src = `/assets/${file}`; // portable path served from public/
  });

  const title = String((page.root.props as { title?: unknown }).title ?? "My landing page").replace(/\s+/g, " ");
  const zip = new JSZip();
  for (const [path, content] of Object.entries(template.files)) {
    zip.file(path, path === "README.md" ? content.replaceAll("{{TITLE}}", title) : content);
  }
  zip.file("data/page.json", `${JSON.stringify(page, null, 2)}\n`);
  for (const { file, blob } of images.values()) zip.file(`public/assets/${file}`, blob);
  if (images.size === 0) zip.file("public/assets/.gitkeep", "");

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  return { blob, imageCount: images.size, missingImages };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
