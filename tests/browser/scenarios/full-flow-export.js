// End-to-end flow used to produce evidence/website.zip (uses Claude: 1 generation + 1 edit).
// Generate from a brief -> manual edits -> mobile override -> AI edit on a selected button -> export.
// Run with --url http://localhost:3211/editor?sample=1 (a fresh browser has no saved page).
(async () => {
  const { sleep, puck, data, doc, type, button, viewport, find, uploadPng, aiStatus } = window.T;
  const log = {};

  // 1. Generate a page from a fresh brief.
  type(
    document.querySelector("#ed-ai-brief"),
    "A specialty coffee roastery called Ember & Oak in Bengaluru. Warm espresso-brown and cream colours, show three single-origin coffees, explain our roasting process, and add a button to visit the café.",
  );
  await sleep(100);
  button("Generate page").click();
  const gen = await aiStatus("generate", 150000);
  log.generate = `${gen.kind} in ${gen.seconds}s`;
  await sleep(1000);

  // 2. Manual edits: headline, hero image, move a button, reorder a section, mobile override.
  doc().querySelector("h1").click();
  await sleep(800);
  const h1Text = doc().querySelector("h1").textContent;
  type([...document.querySelectorAll("input, textarea")].find((i) => i.value === h1Text), "Roasted slowly. Poured with care.");
  await sleep(600);
  log.headline = doc().querySelector("h1").textContent;

  const placeholder = doc().querySelector(".vs-image__placeholder");
  if (placeholder) {
    placeholder.click();
    await sleep(800);
    await uploadPng("EMBER & OAK CAFÉ");
    log.heroImage = find((n) => n.type === "Image" && String(n.props.src).startsWith("asset:"))?.node.props.src;
  }

  const sections = data().root.props.content;
  if (sections.length >= 3) {
    puck().dispatch({ type: "reorder", sourceIndex: sections.length - 1, destinationIndex: 1, destinationZone: "root:content" });
    await sleep(600);
  }
  log.sectionOrder = data().root.props.content.map((s) => s.props.anchor);

  viewport("Mobile").click();
  await sleep(1200);
  doc().querySelector("h1").click();
  await sleep(800);
  type(document.querySelector('input[placeholder="Same as desktop"]'), "34");
  await sleep(600);
  log.h1Mobile = find((n) => n.props.level === "h1").node.props.mobile;
  viewport("Desktop").click();
  await sleep(1000);

  // 3. AI edit on the first button.
  doc().querySelector("a.vs-button").click();
  await sleep(800);
  type(document.querySelector("#ed-ai-instruction"), "Change only this button's background to blue");
  await sleep(100);
  button("Apply with AI").click();
  const edit = await aiStatus("edit", 90000);
  log.aiEdit = `${edit.kind} in ${edit.seconds}s: ${edit.text.slice(0, 90)}`;
  await sleep(800);
  puck().dispatch({ type: "setUi", ui: { itemSelector: null } });
  await sleep(500);

  // 4. Export and capture the ZIP.
  let zipBlob = null;
  const createObjectURL = URL.createObjectURL;
  URL.createObjectURL = (blob) => {
    zipBlob = blob;
    return createObjectURL(blob);
  };
  button("Export website.zip").click();
  for (let i = 0; i < 60 && !zipBlob; i++) await sleep(250);
  log.export = [...document.querySelectorAll(".ed-save")].map((e) => e.textContent).join(" | ");
  const b64 = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.readAsDataURL(zipBlob);
  });
  return { ...log, zipBytes: zipBlob.size, __files: { "website.zip": b64 } };
})();
