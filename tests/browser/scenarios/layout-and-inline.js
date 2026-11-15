// Inline canvas text editing + add / duplicate / delete (free, no AI).
(async () => {
  const { sleep, data, doc, find, waitFor, puck } = window.T;
  const checks = {};
  const count = (type) => {
    let n = 0;
    const walk = (list) =>
      list.forEach((x) => {
        if (x.type === type) n++;
        for (const k of ["content", "left", "right"]) if (Array.isArray(x.props[k])) walk(x.props[k]);
      });
    walk(data().root.props.content);
    return n;
  };
  // The selected element's action bar lives inside the preview iframe. (The Outline panel in the
  // main document also has Duplicate/Delete buttons, one per row, so search the iframe only.)
  const actionButton = (label) =>
    [...doc().querySelectorAll("button")].find((b) =>
      new RegExp(label, "i").test(`${b.getAttribute("aria-label") ?? ""} ${b.title ?? ""}`),
    );

  // 1. Type directly into the heading on the canvas (Puck contentEditable field).
  const h1 = doc().querySelector("h1");
  h1.click();
  await sleep(800);
  // Puck's inline field becomes editable on hover/focus (contentEditable="plaintext-only").
  const field = await waitFor(() => h1.querySelector("[contenteditable]"), "inline text field");
  field.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  const editable = await waitFor(() => (field.isContentEditable ? field : null), "heading to become editable");
  editable.focus();
  doc().execCommand("selectAll");
  doc().execCommand("insertText", false, "Typed on the canvas");
  await sleep(1000);
  checks["Inline canvas text editing"] = { expected: "Typed on the canvas", actual: find((n) => n.props.level === "h1").node.props.text };

  // 2. Duplicate and delete with the element's action bar.
  const paragraphs = count("Paragraph");
  // Select one specific paragraph (the contact section's) so the action bar targets exactly it.
  const target = find((n) => n.type === "Paragraph" && /private fitting/.test(n.props.text)).node;
  puck().dispatch({ type: "setUi", ui: { itemSelector: puck().getSelectorForId(target.props.id) } });
  await sleep(800);
  checks["Selected element"] = { expected: "Paragraph", actual: puck().selectedItem?.type };
  (await waitFor(() => actionButton("duplicate"), "Duplicate button")).click();
  await sleep(800);
  checks["Duplicate (action bar)"] = { expected: paragraphs + 1, actual: count("Paragraph") };
  (await waitFor(() => actionButton("delete"), "Delete button")).click();
  await sleep(800);
  checks["Delete (action bar)"] = { expected: paragraphs, actual: count("Paragraph") };

  // 3. Add: the "insert" action that dropping a block from the Blocks panel dispatches.
  const headings = count("Heading");
  const section = data().root.props.content[1];
  puck().dispatch({ type: "insert", componentType: "Heading", destinationIndex: 0, destinationZone: `${section.props.id}:content` });
  await sleep(800);
  const added = data().root.props.content[1].props.content[0];
  checks["Add element (insert)"] = { expected: `${headings + 1} headings, new one has an id + defaults`, actual: `${count("Heading")} headings, ${added.props.id ? "id ok" : "no id"}, text "${added.props.text}"`, pass: count("Heading") === headings + 1 && !!added.props.id && added.props.text === "Heading" };

  for (const c of Object.values(checks)) if (c.pass === undefined) c.pass = JSON.stringify(c.expected) === JSON.stringify(c.actual);
  return { allPassed: Object.values(checks).every((c) => c.pass), checks };
})();
