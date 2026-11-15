"use client";

import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { FieldLabel, type CustomField } from "@puckeditor/core";
import { registerAssetUrl, resolveImage } from "@/components/site/assets";
import { safeColor } from "@/components/site/style";
import { ALLOWED_IMAGE_TYPES, saveAsset } from "@/lib/storage";

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

function ImageInput({
  value,
  onChange,
  readOnly,
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ kind: "idle" | "busy" | "error"; message?: string }>({
    kind: "idle",
  });
  const image = resolveImage(value);
  const isWebUrl = typeof value === "string" && /^https?:\/\//i.test(value);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    setStatus({ kind: "busy", message: "Uploading…" });
    try {
      const asset = await saveAsset(file); // 1. store the file in IndexedDB
      registerAssetUrl(asset.id, URL.createObjectURL(asset.blob)); // 2. make it viewable
      onChange(`asset:${asset.id}`); // 3. point the element at it (this is undoable)
      setStatus({ kind: "idle" });
    } catch (error) {
      setStatus({ kind: "error", message: error instanceof Error ? error.message : "Upload failed" });
    }
  }

  return (
    <div className="ed-image-field">
      <div className="ed-image-field__preview">
        {image.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt="" />
        ) : (
          <span>{image.label}</span>
        )}
      </div>
      <div className="ed-row">
        <button
          type="button"
          className="ed-mini-button ed-mini-button--primary"
          disabled={readOnly || status.kind === "busy"}
          onClick={() => fileRef.current?.click()}
        >
          {image.kind === "image" ? "Replace image" : "Upload image"}
        </button>
        {value && !value.startsWith("placeholder:") ? (
          <button
            type="button"
            className="ed-mini-button"
            disabled={readOnly}
            onClick={() => onChange("placeholder:Image")}
          >
            Remove
          </button>
        ) : null}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept={ALLOWED_IMAGE_TYPES.join(",")}
        hidden
        onChange={onFile}
      />
      <input
        type="url"
        className="ed-input"
        placeholder="…or paste an https:// image link"
        defaultValue={isWebUrl ? value : ""}
        key={isWebUrl ? value : "empty"}
        disabled={readOnly}
        onBlur={(e) => {
          const url = e.target.value.trim();
          if (url && /^https?:\/\//i.test(url) && url !== value) onChange(url);
        }}
      />
      {status.message ? (
        <p className={status.kind === "error" ? "ed-field-note ed-field-note--error" : "ed-field-note"} role="status">
          {status.message}
        </p>
      ) : null}
    </div>
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
