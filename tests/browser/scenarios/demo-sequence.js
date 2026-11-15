// The challenge's live-evaluation sequence (minutes 2-5) on the starter page.
// Manual edits first, then ONE real AI revision on a selected button.
// Expected: the AI changes only that button's background; all manual edits survive.
// Cost: one small Claude call (~3 s).
(async () => {
  const { sleep, puck, data, doc, type, inputWithValue, button, find, diff, uploadPng, aiStatus } = window.T;
  const checks = {};

  // 1. Rewrite the headline (select it, edit the Text field).
  doc().querySelector("h1").click();
  await sleep(800);
  type(inputWithValue(doc().querySelector("h1").textContent), "Wear the story, not the trend");
  await sleep(600);

  // 2. Replace the hero image (upload).
  doc().querySelector(".vs-image__placeholder").click();
  await sleep(800);
  await uploadPng("NEW HERO PHOTO");

  // 3. Move a button into a different container (same action a drag-and-drop dispatches).
  const hero = find((n) => n.type === "Container");
  const moved = find((n) => n.type === "Button" && n.props.label === "View collection");
  puck().dispatch({
    type: "move",
    sourceIndex: moved.index,
    sourceZone: `${moved.parent}:${moved.slot}`,
    destinationIndex: 4,
    destinationZone: `${hero.node.props.id}:left`,
  });
  await sleep(600);

  // 4. Reorder a section (contact: last -> second).
  puck().dispatch({ type: "reorder", sourceIndex: 2, destinationIndex: 1, destinationZone: "root:content" });
  await sleep(600);

  // 5. Select the hero button and ask the AI.
  const before = JSON.parse(JSON.stringify(data()));
  [...doc().querySelectorAll("a.vs-button")].find((a) => a.textContent.includes("Explore the collections")).click();
  await sleep(800);
  type(document.querySelector("#ed-ai-instruction"), "Change only this button's background to blue");
  await sleep(100);
  button("Apply with AI").click();
  const status = await aiStatus("edit", 90000);
  await sleep(600);

  const changes = diff(before, data());
  const cta = find((n) => n.props.label === "Explore the collections").node;
  checks["AI status"] = { expected: "ok", actual: `${status.kind} (${status.seconds}s): ${status.text}` };
  checks["Only change on the page"] = {
    expected: "exactly 1 change: the button's bgColor",
    actual: changes,
    pass: changes.length === 1 && /bgColor/.test(changes[0]),
  };
  checks["Headline kept"] = { expected: "Wear the story, not the trend", actual: find((n) => n.props.level === "h1").node.props.text };
  checks["Uploaded image kept"] = { expected: "asset:…", actual: find((n) => n.type === "Image").node.props.src };
  checks["Moved button still in hero"] = { expected: true, actual: find((n) => n.props.id === moved.node.props.id).parent === hero.node.props.id };
  checks["Section order kept"] = { expected: ["", "contact", "collections"], actual: data().root.props.content.map((s) => s.props.anchor) };

  // 6. Undo / redo the AI edit.
  await sleep(400);
  document.querySelector('button[title="undo"]').click();
  await sleep(900);
  const afterUndo = find((n) => n.props.id === cta.props.id).node.props.bgColor;
  document.querySelector('button[title="redo"]').click();
  await sleep(900);
  const afterRedo = find((n) => n.props.id === cta.props.id).node.props.bgColor;
  checks["Undo / redo"] = { expected: "#c9a44c / blue", actual: `${afterUndo} / ${afterRedo}` };

  for (const c of Object.values(checks)) {
    if (c.pass === undefined) c.pass = JSON.stringify(c.expected) === JSON.stringify(c.actual) || (typeof c.actual === "string" && c.actual.startsWith(String(c.expected).replace("…", "")));
  }
  checks["AI status"].pass = status.kind === "ed-ai-status--ok";
  checks["Undo / redo"].pass = afterUndo === "#c9a44c" && afterRedo !== "#c9a44c";
  return { allPassed: Object.values(checks).every((c) => c.pass), checks };
})();
