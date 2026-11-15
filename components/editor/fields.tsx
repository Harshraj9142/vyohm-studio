"use client";

import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { FieldLabel, useGetPuck, type CustomField } from "@puckeditor/core";
import { registerAssetUrl, resolveImage } from "@/components/site/assets";
import { safeColor } from "@/components/site/style";
import {
  ALLOWED_IMAGE_TYPES,
  checkImageFile,
  getAsset,
  MAX_IMAGE_BYTES,
  MAX_ORIGINAL_BYTES,
  saveAsset,
  type StoredAsset,
} from "@/lib/storage";
import { CropDialog, type CropSource } from "./image-crop";

/**
 * Custom fields for the settings panel (right sidebar).
 * Puck has text/number/select fields built in; colours and image upload are ours.
 */

// ---------------------------------------------------------------- Colour

function ColorInput({
  value,
  onChange,
  readOnly,
  emptyLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  emptyLabel: string;
}) {
  // Local text so the user can type freely; we only save valid #hex colours.
  const [draft, setDraft] = useState<string | null>(null);
  const valid = safeColor(value);
  const text = draft ?? value ?? "";
  const draftInvalid = draft !== null && draft !== "" && !safeColor(draft);

  return (
    <div className="ed-color-field">
      <input
        type="color"
        aria-label="Pick a colour"
        value={valid && valid.length === 7 ? valid : "#000000"}
        disabled={readOnly}
        onChange={(e) => {
          setDraft(null);
          onChange(e.target.value);
        }}
      />
      <input
        type="text"
        className={draftInvalid ? "ed-input ed-input--invalid" : "ed-input"}
        placeholder={emptyLabel}
        value={text}
        disabled={readOnly}
        aria-invalid={draftInvalid}
        onChange={(e) => {
          const next = e.target.value.trim();
          setDraft(next);
          if (next === "" || safeColor(next)) onChange(next);
        }}
        onBlur={() => setDraft(null)}
      />
      {value ? (
        <button type="button" className="ed-mini-button" disabled={readOnly} onClick={() => onChange("")}>
          Clear
        </button>
      ) : null}
    </div>
  );
}

export function colorField(label: string, emptyLabel = "Inherit"): CustomField<string> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange, readOnly }) => (
      <FieldLabel label={label} readOnly={readOnly} el="div">
        <ColorInput value={value} onChange={onChange} readOnly={readOnly} emptyLabel={emptyLabel} />
      </FieldLabel>
    ),
  };
}

// ---------------------------------------------------------------- Image

/**
 * Image field: upload (button or drag & drop), crop, or use a link.
 *
 * Upload flow: pick/drop a file -> crop dialog -> on "Apply crop" we store the
 * original AND the cropped file in IndexedDB (the cropped one remembers its original,
 * so "Crop" can start again from the full picture) -> the element points at
 * "asset:<id>". The page change goes through onChange, so it is undoable.
 */

type CropRequest = {
  source: CropSource;
  /** A new upload, kept for "Use without cropping" and stored as the original. */
  file?: File;
  /** The full picture is already stored (re-cropping an uploaded image). */
  originalId?: string;
  boxAspect?: number;
};

const isWebLink = (value: unknown): value is string => typeof value === "string" && /^https?:\/\//i.test(value);

function ImageInput({
  value,
  onChange,
  readOnly,
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}) {
  const getPuck = useGetPuck();
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ kind: "idle" | "busy" | "error"; message?: string }>({ kind: "idle" });
  const [crop, setCrop] = useState<CropRequest | null>(null);
  const [dragging, setDragging] = useState(false);
  const image = resolveImage(value);
  const isAsset = typeof value === "string" && value.startsWith("asset:");
  const canCrop = image.kind === "image" && (isAsset || isWebLink(value));
  const busy = status.kind === "busy";

  function openCrop(blob: Blob, name: string, extra: Omit<CropRequest, "source" | "boxAspect">) {
    setCrop({
      source: { url: URL.createObjectURL(blob), name, type: blob.type },
      boxAspect: selectedImageBoxAspect(getPuck().selectedItem?.props?.id),
      ...extra,
    });
  }

  function closeCrop() {
    if (crop) URL.revokeObjectURL(crop.source.url);
    setCrop(null);
  }

  function showAsset(asset: StoredAsset) {
    registerAssetUrl(asset.id, URL.createObjectURL(asset.blob)); // make it viewable in the editor
    onChange(`asset:${asset.id}`); // point the element at it (undoable)
    setStatus({ kind: "idle" });
  }

  function onPicked(file: File | undefined) {
    if (!file || readOnly) return;
    try {
      checkImageFile(file, MAX_ORIGINAL_BYTES);
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Upload failed" });
      return;
    }
    setStatus({ kind: "idle" });
    openCrop(file, file.name, { file });
  }

  async function applyCrop(cropped: File) {
    if (!crop) return;
    const originalId =
      crop.originalId ?? (crop.file ? (await saveAsset(crop.file, { maxBytes: MAX_ORIGINAL_BYTES })).id : undefined);
    const asset = await saveAsset(cropped, { originalId });
    closeCrop();
    showAsset(asset);
  }

  async function keepUncropped() {
    if (!crop?.file) return;
    const asset = await saveAsset(crop.file);
    closeCrop();
    showAsset(asset);
  }

  /** Crop the current image again: uploaded images start from their full original. */
  async function recrop() {
    setStatus({ kind: "busy", message: "Opening the image…" });
    try {
      if (isAsset) {
        const current = await getAsset(value.slice("asset:".length));
        if (!current) throw new Error("This image is no longer in this browser. Please upload it again.");
        const full = (current.originalId && (await getAsset(current.originalId))) || current;
        setStatus({ kind: "idle" });
        openCrop(full.blob, full.name, { originalId: full.id });
      } else if (isWebLink(value)) {
        await copyFromLink(value);
      }
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Could not open the image." });
    }
  }

  /** Download a linked picture so it can be cropped and stored with the page. */
  async function copyFromLink(url: string) {
    setStatus({ kind: "busy", message: "Downloading the image…" });
    try {
      const blob = await downloadImage(url);
      const name = decodeURIComponent(new URL(url).pathname.split("/").pop() || "image") || "image";
      setStatus({ kind: "idle" });
      openCrop(blob, name, { file: new File([blob], name, { type: blob.type }) });
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Could not download the image." });
    }
  }

  return (
    <div className="ed-image-field">
      <div
        className={`ed-drop${dragging ? " ed-drop--active" : ""}${image.kind === "image" ? " ed-drop--filled" : ""}`}
        onDragEnter={(e) => {
          if (!readOnly && e.dataTransfer.types.includes("Files")) setDragging(true);
        }}
        onDragOver={(e) => {
          if (readOnly || !e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onPicked(e.dataTransfer.files?.[0]);
        }}
      >
        {image.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt="" />
        ) : (
          <div className="ed-drop__empty">
            <UploadIcon />
            <strong>Drop an image here</strong>
            <span>
              {image.label !== "Image" ? `Placeholder: ${image.label}` : "JPG, PNG, WebP or GIF"}
            </span>
          </div>
        )}
        {dragging ? <div className="ed-drop__overlay">Drop to upload</div> : null}
      </div>

      <div className="ed-row ed-row--wrap">
        <button
          type="button"
          className="ed-mini-button ed-mini-button--primary"
          disabled={readOnly || busy}
          onClick={() => fileRef.current?.click()}
        >
          {image.kind === "image" ? "Replace image" : "Upload image"}
        </button>
        {canCrop ? (
          <button type="button" className="ed-mini-button" disabled={readOnly || busy} onClick={recrop}>
            <CropIcon /> Crop
          </button>
        ) : null}
        {value && !value.startsWith("placeholder:") ? (
          <button
            type="button"
            className="ed-icon-button ed-image-remove"
            aria-label="Remove image"
            title="Remove image (back to a placeholder)"
            disabled={readOnly || busy}
            onClick={() => onChange("placeholder:Image")}
          >
            <TrashIcon />
          </button>
        ) : null}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        hidden
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // allow picking the same file again
          onPicked(file);
        }}
      />

      <details className="ed-link-details" open={isWebLink(value) || undefined}>
        <summary>Use an image link</summary>
        <ImageLink
          key={isWebLink(value) ? value : "none"}
          current={isWebLink(value) ? value : ""}
          readOnly={readOnly || busy}
          onUseLink={(url) => {
            onChange(url);
            setStatus({ kind: "idle", message: "Using the link. It stays on the other website and is not copied into the export." });
          }}
          onSaveCopy={copyFromLink}
        />
      </details>

      {status.message ? (
        <p className={status.kind === "error" ? "ed-field-note ed-field-note--error" : "ed-field-note"} role="status">
          {status.message}
        </p>
      ) : null}

      {crop ? (
        <CropDialog
          source={crop.source}
          boxAspect={crop.boxAspect}
          onApply={applyCrop}
          onUseOriginal={
            crop.file
              ? {
                  run: keepUncropped,
                  disabledReason:
                    crop.file.size > MAX_IMAGE_BYTES ? "This photo is over 8 MB. Crop it to make it smaller." : undefined,
                }
              : undefined
          }
          onCancel={closeCrop}
        />
      ) : null}
    </div>
  );
}

/** Paste a link, preview it, then use it as a link or save a copy (which can be cropped). */
function ImageLink({
  current,
  readOnly,
  onUseLink,
  onSaveCopy,
}: {
  current: string;
  readOnly?: boolean;
  onUseLink: (url: string) => void;
  onSaveCopy: (url: string) => void;
}) {
  const [url, setUrl] = useState(current);
  const [check, setCheck] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "ok"; url: string; width: number; height: number }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const latest = useRef(0);

  function preview() {
    const link = url.trim();
    if (!isWebLink(link)) {
      setCheck({ kind: "error", message: "Paste a link that starts with https://" });
      return;
    }
    const token = ++latest.current; // ignore answers for older links
    setCheck({ kind: "loading" });
    const img = new Image();
    img.onload = () => token === latest.current && setCheck({ kind: "ok", url: link, width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () =>
      token === latest.current &&
      setCheck({ kind: "error", message: "No image could be loaded from this link. It should point to a JPG, PNG, WebP or GIF file." });
    img.src = link;
  }

  return (
    <div className="ed-link">
      <div className="ed-row">
        <input
          type="url"
          className="ed-input"
          placeholder="https://example.com/photo.jpg"
          aria-label="Image link"
          value={url}
          disabled={readOnly}
          onChange={(e) => {
            setUrl(e.target.value);
            setCheck({ kind: "idle" });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              preview();
            }
          }}
        />
        <button
          type="button"
          className="ed-mini-button"
          disabled={readOnly || !url.trim() || check.kind === "loading"}
          onClick={preview}
        >
          {check.kind === "loading" ? "Checking…" : "Preview"}
        </button>
      </div>

      {check.kind === "ok" ? (
        <div className="ed-link__result">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={check.url} alt="" />
          <div className="ed-link__info">
            <span className="ed-link__ok">
              <CheckIcon /> Image found · {check.width} × {check.height} px
            </span>
            <div className="ed-row ed-row--wrap">
              <button
                type="button"
                className="ed-mini-button ed-mini-button--primary"
                disabled={readOnly || check.url === current}
                onClick={() => onUseLink(check.url)}
              >
                {check.url === current ? "In use" : "Use link"}
              </button>
              <button type="button" className="ed-mini-button" disabled={readOnly} onClick={() => onSaveCopy(check.url)}>
                Save a copy & crop
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {check.kind === "error" ? (
        <p className="ed-field-note ed-field-note--error" role="alert">
          {check.message}
        </p>
      ) : null}
      <p className="ed-field-note ed-field-note--muted">
        A link stays on the other website. <strong>Save a copy</strong> stores the picture with your page, lets you crop
        it, and includes it in the export.
      </p>
    </div>
  );
}

/** Fetch a linked image as a file. Fails with a readable message if the site blocks copying. */
async function downloadImage(url: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(url, { mode: "cors" });
  } catch {
    throw new Error(
      "This website doesn't allow other sites to copy its images, so it can't be saved or cropped here. You can still use it as a link.",
    );
  }
  if (!response.ok) throw new Error(`The link answered with an error (${response.status}).`);
  const blob = await response.blob();
  checkImageFile(blob, MAX_ORIGINAL_BYTES);
  return blob;
}

/**
 * Width / height of the selected Image's box in the preview, so the crop can match it
 * exactly. Returns undefined if it can't be measured (the crop then starts at "Original").
 */
function selectedImageBoxAspect(id: unknown): number | undefined {
  if (typeof id !== "string") return undefined;
  for (const frame of Array.from(document.querySelectorAll("iframe"))) {
    let box: Element | null | undefined;
    try {
      box = frame.contentDocument?.querySelector(`[data-puck-component="${CSS.escape(id)}"] .vs-image__media`);
    } catch {
      continue; // not our preview frame
    }
    const rect = box?.getBoundingClientRect();
    if (rect && rect.width > 8 && rect.height > 8) return rect.width / rect.height;
  }
  return undefined;
}

function UploadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 16V4M7 9l5-5 5 5" />
      <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function CropIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 2v14a2 2 0 0 0 2 2h14" />
      <path d="M18 22V8a2 2 0 0 0-2-2H2" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export const imageField: CustomField<string> = {
  type: "custom",
  label: "Image",
  render: ({ value, onChange, readOnly }) => (
    <FieldLabel label="Image" readOnly={readOnly} el="div">
      <ImageInput value={value} onChange={onChange} readOnly={readOnly} />
    </FieldLabel>
  ),
};

// ---------------------------------------------------------------- Optional number

/**
 * A number that may be left empty. Used for mobile overrides:
 * empty (null) means "same as desktop". Puck's built-in number field turns an
 * empty box into 0, which would be a real value, so we use our own.
 */
function OptionalNumberInput({
  value,
  onChange,
  readOnly,
  min,
  max,
  unit,
}: {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  readOnly?: boolean;
  min: number;
  max: number;
  unit: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? (typeof value === "number" ? String(value) : "");

  return (
    <div className="ed-row">
      <input
        type="number"
        className="ed-input"
        min={min}
        max={max}
        placeholder="Same as desktop"
        value={text}
        disabled={readOnly}
        onChange={(e) => {
          const raw = e.target.value;
          setDraft(raw);
          if (raw === "") return onChange(null);
          const n = Number(raw);
          if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }}
        onBlur={() => setDraft(null)}
      />
      <span className="ed-unit">{unit}</span>
    </div>
  );
}

export function optionalNumberField(
  label: string,
  opts: { min: number; max: number; unit?: string },
): CustomField<number | null | undefined> {
  return {
    type: "custom",
    label,
    render: ({ value, onChange, readOnly }) => (
      <FieldLabel label={label} readOnly={readOnly} el="div">
        <OptionalNumberInput
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          min={opts.min}
          max={opts.max}
          unit={opts.unit ?? "px"}
        />
      </FieldLabel>
    ),
  };
}

// ---------------------------------------------------------------- Help note

/** A short note shown above a component's fields, e.g. which children it accepts. */
export function withNote(note: ReactNode) {
  function FieldsWithNote({ fields }: { fields: Partial<Record<string, ReactNode>> }) {
    return (
      <>
        <p className="ed-field-note ed-field-note--info">{note}</p>
        {Object.values(fields)}
      </>
    );
  }
  return FieldsWithNote;
}
