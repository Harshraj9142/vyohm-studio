// Image field: drop a photo -> crop dialog -> crop; crop again from the full original;
// undo/redo; cancel; image links (broken link, preview, use link, save a copy and crop).
// No AI calls. The "save a copy" download is faked (fetch returns a PNG) so it needs no network.
(async () => {
  const { sleep, doc, find, waitFor, click, type, puck } = window.T;
  const checks = {};
  const check = (name, expected, actual, pass = JSON.stringify(expected) === JSON.stringify(actual)) =>
    (checks[name] = { expected, actual, pass });
  const src = () => find((n) => n.type === "Image").node.props.src;
  const dialog = () => document.querySelector(".ed-crop[role=dialog]");
  const chip = (label) => [...dialog().querySelectorAll(".ed-chip")].find((b) => b.textContent === label);
  const pressedChip = () => [...dialog().querySelectorAll(".ed-chip")].find((b) => b.getAttribute("aria-pressed") === "true")?.textContent;
  const loadedSize = async () => {
    const img = await waitFor(() => {
      const el = doc().querySelector(".vs-image__media");
      return el && el.tagName === "IMG" && el.complete && el.naturalWidth > 0 ? el : null;
    }, "cropped image in the preview");
    return [img.naturalWidth, img.naturalHeight];
  };
  async function applyAndClose() {
    await click("Apply crop", dialog());
    await waitFor(() => !dialog(), "crop dialog to close");
    await sleep(700);
  }

  // A wide 1600 x 900 test photo.
  const canvas = document.createElement("canvas");
  canvas.width = 1600;
  canvas.height = 900;
  const g = canvas.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 1600, 900);
  grad.addColorStop(0, "#f2c14e");
  grad.addColorStop(1, "#3a1c71");
  g.fillStyle = grad;
  g.fillRect(0, 0, 1600, 900);
  const photo = new File([await new Promise((r) => canvas.toBlob(r, "image/jpeg", 0.9))], "wide.jpg", { type: "image/jpeg" });

  // 1. Select the hero image and DROP the photo on the image field.
  doc().querySelector(".vs-image__placeholder").click();
  await sleep(1000);
  const dt = new DataTransfer();
  dt.items.add(photo);
  document.querySelector(".ed-drop").dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt }));
  await waitFor(dialog, "crop dialog");
  await sleep(800);
  check("Dropping a photo opens the crop dialog, set to the image box's shape", "Image box", pressedChip());
  check("Nothing changes on the page until the crop is applied", true, src().startsWith("placeholder:"));

  // 2. Square crop.
  chip("1:1").click();
  await sleep(500);
  await applyAndClose();
  const [w1, h1] = await loadedSize();
  check("1:1 crop gives a square image (about 900 x 900)", "square, ≥ 895 px", `${w1} x ${h1}`, Math.abs(w1 - h1) <= 1 && h1 >= 895);
  check("The image now points at an uploaded file", true, src().startsWith("asset:"));
  const squareSrc = src();

  // 3. Crop again: it must start from the full 1600 x 900 original, not from the square.
  await click("Crop");
  await waitFor(dialog, "crop dialog (crop again)");
  await sleep(800);
  const note = dialog().querySelector(".ed-field-note").textContent;
  check("Crop again starts from the full original", "Original 1600 × 900 px", note.match(/Original \d+ × \d+ px/)?.[0]);
  chip("16:9").click();
  await sleep(500);
  await applyAndClose();
  const [w2, h2] = await loadedSize();
  check("16:9 re-crop of the original keeps the full width", "16:9, ≥ 1590 px wide", `${w2} x ${h2}`, Math.abs(w2 / h2 - 16 / 9) < 0.01 && w2 >= 1590);
  const wideSrc = src();

  // 4. Undo / redo.
  puck().history.back();
  await sleep(700);
  check("Undo restores the square crop", squareSrc, src());
  puck().history.forward();
  await sleep(700);
  check("Redo restores the 16:9 crop", wideSrc, src());

  // 5. Cancel changes nothing.
  await click("Crop");
  await waitFor(dialog, "crop dialog (cancel)");
  await click("Cancel", dialog());
  await waitFor(() => !dialog(), "crop dialog to close after Cancel");
  check("Cancel leaves the image unchanged", wideSrc, src());

  // 5b. Rotate: original shape + rotate right turns the 1600 x 900 photo into a portrait.
  await click("Crop");
  await waitFor(dialog, "crop dialog (rotate)");
  await sleep(600);
  chip("Original").click();
  await sleep(300);
  dialog().querySelector('button[aria-label="Rotate right"]').click();
  await sleep(700);
  await applyAndClose();
  const [w3, h3] = await loadedSize();
  check("Rotate right + Original gives a 900 x 1600 portrait", "about 900 x 1600", `${w3} x ${h3}`, Math.abs(w3 - 900) <= 2 && Math.abs(h3 - 1600) <= 2);
  const rotatedSrc = src();

  // 5c. Zooming in makes the result smaller; Escape closes the dialog without changes.
  await click("Crop");
  await waitFor(dialog, "crop dialog (zoom + Escape)");
  await sleep(600);
  const resultText = () => dialog().querySelector(".ed-field-note").textContent.match(/result (\d+) × (\d+)/);
  const before = resultText();
  const slider = dialog().querySelector('input[type="range"]');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(slider, "2");
  slider.dispatchEvent(new Event("input", { bubbles: true }));
  await sleep(700);
  const after = resultText();
  check("Zoom 2× halves the result size", "about half", `${before?.[1]} → ${after?.[1]} px wide`, !!before && !!after && Math.abs(Number(after[1]) * 2 - Number(before[1])) <= 4);
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  await waitFor(() => !dialog(), "Escape to close the dialog");
  check("Escape closes the dialog and changes nothing", rotatedSrc, src());

  // 6. Image links.
  document.querySelector(".ed-link-details").open = true;
  await sleep(300);
  type(document.querySelector('input[aria-label="Image link"]'), "https://example.invalid/missing.jpg");
  await click("Preview");
  const error = await waitFor(() => document.querySelector(".ed-link .ed-field-note--error"), "broken-link message", 20000);
  check("A broken link shows a clear message and changes nothing", [true, rotatedSrc], [/No image could be loaded/.test(error.textContent), src()]);

  const iconUrl = `${location.origin}/favicon.ico`;
  type(document.querySelector('input[aria-label="Image link"]'), iconUrl);
  await click("Preview");
  const ok = await waitFor(() => document.querySelector(".ed-link__ok"), "link preview");
  check("A working link shows a preview and its size", "Image found · W × H px", ok.textContent.trim(), /Image found · \d+ × \d+ px/.test(ok.textContent));
  await click("Use link");
  await sleep(600);
  check("Use link points the image at the link", iconUrl, src());

  // 7. Crop a linked image: it is downloaded (faked here), cropped and stored with the page.
  const png = await new Promise((r) => {
    const k = document.createElement("canvas");
    k.width = 400;
    k.height = 300;
    k.getContext("2d").fillRect(0, 0, 400, 300);
    k.toBlob(r, "image/png");
  });
  const realFetch = window.fetch;
  window.fetch = async (url, init) =>
    String(url) === iconUrl ? new Response(png, { headers: { "content-type": "image/png" } }) : realFetch(url, init);
  await click("Crop");
  await waitFor(dialog, "crop dialog for the linked image");
  await sleep(600);
  await applyAndClose();
  window.fetch = realFetch;
  check("Cropping a linked image stores a copy with the page", true, src().startsWith("asset:"));

  return { checks };
})();
