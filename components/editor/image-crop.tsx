"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Cropper, { type Area } from "react-easy-crop";

/**
 * Crop dialog for images (opens when you upload, drop or re-crop an image).
 *
 * react-easy-crop draws the interactive cropper (drag to move, scroll/pinch/slider
 * to zoom). This file owns everything around it: shape presets, rotation, the
 * dialog itself, and turning the chosen area into a new, smaller image file.
 */

/** The longest side of a cropped image. Big enough for a full-width hero, small enough to export. */
export const MAX_OUTPUT_SIDE = 2400;

export type CropSource = { url: string; name: string; type: string };

type ShapeKey = "box" | "original" | "1:1" | "4:3" | "3:2" | "16:9" | "3:4" | "4:5";

const FIXED_SHAPES: { key: ShapeKey; label: string; aspect: number }[] = [
  { key: "1:1", label: "1:1", aspect: 1 },
  { key: "4:3", label: "4:3", aspect: 4 / 3 },
  { key: "3:2", label: "3:2", aspect: 3 / 2 },
  { key: "16:9", label: "16:9", aspect: 16 / 9 },
  { key: "3:4", label: "3:4", aspect: 3 / 4 },
  { key: "4:5", label: "4:5", aspect: 4 / 5 },
];

export function CropDialog({
  source,
  boxAspect,
  onApply,
  onUseOriginal,
  onCancel,
}: {
  source: CropSource;
  /** Width / height of the image's box on the page, if known. Used as the default shape. */
  boxAspect?: number;
  onApply: (file: File) => Promise<void> | void;
  /** Offered for new uploads: keep the picture as it is. */
  onUseOriginal?: { run: () => Promise<void> | void; disabledReason?: string };
  onCancel: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [shape, setShape] = useState<ShapeKey>(boxAspect ? "box" : "original");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  // The stage's layout size (clientWidth/Height ignore the dialog's opening animation), for coverZoom().
  const [stage, setStage] = useState<{ width: number; height: number } | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setStage({ width: el.clientWidth, height: el.clientHeight }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Focus the dialog once when it opens; Escape closes it (unless it is saving).
  const escape = useRef(() => {});
  useEffect(() => {
    escape.current = () => {
      if (!busy) onCancel();
    };
  });
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") escape.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus?.(); // back to the button that opened the dialog
    };
  }, []);

  function aspectFor(key: ShapeKey, turn: number): number {
    if (key === "box" && boxAspect) return boxAspect;
    const sideways = turn % 180 !== 0;
    const original = natural ? (sideways ? natural.height / natural.width : natural.width / natural.height) : 4 / 3;
    return key === "original" ? original : (FIXED_SHAPES.find((s) => s.key === key)?.aspect ?? original);
  }

  /**
   * The smallest zoom at which the picture still covers the whole crop box.
   * Normally 1. After a 90° turn the picture can be taller than the stage, so the crop
   * box (which must fit the stage) would only reach part of it at zoom 1; letting the
   * zoom go below 1 lets "Original" take the whole turned picture. The crop box size
   * follows react-easy-crop's rule: the largest box of this shape inside both the
   * turned picture and the stage.
   */
  function coverZoom(turn: number, shapeAspect: number): number {
    if (!natural || !stage) return 1;
    // The picture at zoom 1, unturned, fitted inside the stage ("contain").
    const pictureAspect = natural.width / natural.height;
    const media =
      stage.width / stage.height > pictureAspect
        ? { width: stage.height * pictureAspect, height: stage.height }
        : { width: stage.width, height: stage.width / pictureAspect };
    const sideways = turn % 180 !== 0;
    const mw = sideways ? media.height : media.width;
    const mh = sideways ? media.width : media.height;
    const fitW = Math.min(mw, stage.width);
    const fitH = Math.min(mh, stage.height);
    const box = fitW > fitH * shapeAspect ? { w: fitH * shapeAspect, h: fitH } : { w: fitW, h: fitW / shapeAspect };
    return Math.min(1, Math.max(box.w / mw, box.h / mh));
  }

  const aspect = aspectFor(shape, rotation);
  const minZoom = coverZoom(rotation, aspect);

  const scale = area ? Math.min(1, MAX_OUTPUT_SIDE / Math.max(area.width, area.height)) : 1;
  const resultSize = area ? `${Math.round(area.width * scale)} × ${Math.round(area.height * scale)} px` : "";

  function chooseShape(next: ShapeKey) {
    setShape(next);
    setCrop({ x: 0, y: 0 });
    setZoom(coverZoom(rotation, aspectFor(next, rotation)));
  }

  function rotate(by: number) {
    const next = (rotation + by + 360) % 360;
    setRotation(next);
    setCrop({ x: 0, y: 0 });
    setZoom(coverZoom(next, aspectFor(shape, next))); // show the whole turned picture
  }

  async function apply() {
    if (!area) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await cropToBlob(source.url, area, rotation);
      const ext = blob.type === "image/png" ? "png" : "jpg";
      const base = source.name.replace(/\.[a-z0-9]+$/i, "") || "image";
      await onApply(new File([blob], `${base}-cropped.${ext}`, { type: blob.type }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not crop this image.");
      setBusy(false);
    }
  }

  async function useOriginal() {
    if (!onUseOriginal) return;
    setBusy(true);
    setError(null);
    try {
      await onUseOriginal.run();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this image.");
      setBusy(false);
    }
  }

  const shapeButtons: { key: ShapeKey; label: string; title?: string }[] = [
    ...(boxAspect ? [{ key: "box" as const, label: "Image box", title: "The shape of the image's box on your page" }] : []),
    { key: "original", label: "Original" },
    ...FIXED_SHAPES,
  ];

  return createPortal(
    <div className="ed-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
      <div ref={dialogRef} tabIndex={-1} className="ed-modal ed-crop" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="ed-modal__header">
          <h2 id={titleId} className="ed-modal__title">
            Crop image
          </h2>
          <button type="button" className="ed-icon-button" aria-label="Close" onClick={onCancel} disabled={busy}>
            <CloseIcon />
          </button>
        </header>

        <div ref={stageRef} className="ed-crop__stage">
          <Cropper
            image={source.url}
            crop={crop}
            zoom={Math.max(zoom, minZoom)}
            rotation={rotation}
            aspect={aspect}
            minZoom={minZoom}
            maxZoom={5}
            zoomSpeed={0.4}
            showGrid
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
            onMediaLoaded={(loaded) => setNatural({ width: loaded.naturalWidth, height: loaded.naturalHeight })}
            mediaProps={{ alt: "" }}
          />
        </div>

        <div className="ed-crop__controls">
          <div className="ed-crop__group" role="group" aria-label="Shape">
            <span className="ed-crop__label">Shape</span>
            <div className="ed-chips">
              {shapeButtons.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className="ed-chip"
                  aria-pressed={shape === s.key}
                  title={s.title}
                  onClick={() => chooseShape(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ed-crop__group ed-crop__group--row">
            <label className="ed-crop__label" htmlFor={`${titleId}-zoom`}>
              Zoom
            </label>
            <input
              id={`${titleId}-zoom`}
              className="ed-range"
              type="range"
              min={minZoom}
              max={5}
              step={0.01}
              value={Math.max(zoom, minZoom)}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
            <button type="button" className="ed-icon-button" aria-label="Rotate left" title="Rotate left" onClick={() => rotate(-90)}>
              <RotateIcon flip />
            </button>
            <button type="button" className="ed-icon-button" aria-label="Rotate right" title="Rotate right" onClick={() => rotate(90)}>
              <RotateIcon />
            </button>
          </div>

          <p className="ed-field-note">
            Drag the picture to move it, scroll or use the slider to zoom.
            {natural ? ` Original ${natural.width} × ${natural.height} px` : ""}
            {resultSize ? ` → result ${resultSize}.` : ""}
            {source.type === "image/gif" ? " Cropping turns an animated GIF into a still image." : ""}
          </p>
          {error ? (
            <p className="ed-field-note ed-field-note--error" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="ed-modal__footer">
          {onUseOriginal ? (
            <button
              type="button"
              className="ed-mini-button ed-modal__secondary"
              onClick={useOriginal}
              disabled={busy || !!onUseOriginal.disabledReason}
              title={onUseOriginal.disabledReason}
            >
              Use without cropping
            </button>
          ) : null}
          <button type="button" className="ed-mini-button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="ed-mini-button ed-mini-button--primary"
            onClick={apply}
            disabled={busy || !area}
          >
            {busy ? "Saving…" : "Apply crop"}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

// ---------------------------------------------------------------- cropping

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read this image."));
    image.src = url;
  });
}

/**
 * Draws the chosen area into a new canvas and returns it as a file blob.
 *
 * react-easy-crop gives the area in the coordinates of the ROTATED image's bounding
 * box, so we draw the image rotated around that box's centre, shifted by the area's
 * top-left corner. Large crops are scaled down to MAX_OUTPUT_SIDE.
 * Photos become JPEG (small); images with transparent pixels stay PNG.
 */
export async function cropToBlob(url: string, area: Area, rotation: number): Promise<Blob> {
  const image = await loadImage(url);
  const w = image.naturalWidth;
  const h = image.naturalHeight;
  const rad = (rotation * Math.PI) / 180;
  const boxW = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
  const boxH = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));

  const scale = Math.min(1, MAX_OUTPUT_SIDE / Math.max(area.width, area.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(area.width * scale));
  canvas.height = Math.max(1, Math.round(area.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not crop this image.");
  ctx.imageSmoothingQuality = "high";
  ctx.scale(scale, scale);
  ctx.translate(-area.x, -area.y);
  ctx.translate(boxW / 2, boxH / 2);
  ctx.rotate(rad);
  ctx.drawImage(image, -w / 2, -h / 2);

  const type = hasTransparency(canvas) ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
  if (!blob) throw new Error("Your browser could not save the cropped image.");
  return blob;
}

/** True if any pixel is (partly) transparent; checked on a small copy to stay fast. */
function hasTransparency(canvas: HTMLCanvasElement): boolean {
  const size = 64;
  const small = document.createElement("canvas");
  small.width = size;
  small.height = size;
  const ctx = small.getContext("2d", { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(canvas, 0, 0, size, size);
  const pixels = ctx.getImageData(0, 0, size, size).data;
  for (let i = 3; i < pixels.length; i += 4) if (pixels[i] < 250) return true;
  return false;
}

// ---------------------------------------------------------------- icons

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function RotateIcon({ flip }: { flip?: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
    >
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </svg>
  );
}
