/**
 * Image source helpers.
 *
 * In the editor, uploaded images are stored in the browser (IndexedDB) and the
 * page only keeps a short reference like "asset:3f2a9c". The editor registers a
 * temporary browser URL for each reference here, so the Image block can show it.
 *
 * In the exported project every "asset:<id>" is rewritten to "/assets/<file>",
 * so nothing needs to be registered there.
 */

const assetUrls = new Map<string, string>();

export function registerAssetUrl(id: string, url: string) {
  assetUrls.set(id, url);
}

export type ResolvedImage =
  | { kind: "image"; url: string }
  | { kind: "placeholder"; label: string };

export function resolveImage(src: unknown): ResolvedImage {
  if (typeof src !== "string" || src.trim() === "") {
    return { kind: "placeholder", label: "Image" };
  }
  if (src.startsWith("placeholder:")) {
    return { kind: "placeholder", label: src.slice("placeholder:".length).trim() || "Image" };
  }
  if (src.startsWith("asset:")) {
    const url = assetUrls.get(src.slice("asset:".length));
    return url ? { kind: "image", url } : { kind: "placeholder", label: "Missing image" };
  }
  if (/^https?:\/\//i.test(src) || src.startsWith("/") || /^data:image\/(png|jpe?g|webp|gif);/i.test(src)) {
    return { kind: "image", url: src };
  }
  return { kind: "placeholder", label: "Unsupported image source" };
}
