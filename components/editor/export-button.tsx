"use client";

import { useState } from "react";
import { Button, useGetPuck } from "@puckeditor/core";
import { buildWebsiteZip, downloadBlob } from "@/lib/export/build-zip";

/** "Export" button in the header: downloads website.zip (a runnable Next.js project). */
export function ExportButton() {
  const getPuck = useGetPuck();
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "busy" } | { kind: "done"; text: string } | { kind: "error"; text: string }
  >({ kind: "idle" });

  async function exportSite() {
    setStatus({ kind: "busy" });
    try {
      const { blob, imageCount, missingImages } = await buildWebsiteZip(getPuck().appState.data);
      downloadBlob(blob, "website.zip");
      const images = `${imageCount} image${imageCount === 1 ? "" : "s"}`;
      setStatus({
        kind: "done",
        text: missingImages > 0 ? `Exported (${images}, ${missingImages} missing)` : `Exported with ${images}`,
      });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Export failed." });
    }
  }

  return (
    <>
      {status.kind === "done" || status.kind === "error" ? (
        <span
          className={`ed-save ${status.kind === "error" ? "ed-save--error" : ""}`}
          role="status"
          aria-live="polite"
          title={status.text}
        >
          {status.kind === "error" ? "Export failed" : status.text}
        </span>
      ) : null}
      {/* type="button" makes Puck render a real, keyboard-accessible <button> (otherwise a <span>). */}
      <Button
        type="button"
        variant="secondary"
        icon={<DownloadIcon />}
        onClick={exportSite}
        loading={status.kind === "busy"}
        disabled={status.kind === "busy"}
      >
        Export website.zip
      </Button>
    </>
  );
}

function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v11M7 10l5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}
