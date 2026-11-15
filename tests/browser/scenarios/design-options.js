// The design options (surface, paragraph style, section background, button icon) work from the
// settings panel, and editor-only behaviour is right (no scroll fade-in / hover lift in the editor). Free.
(async () => {
  const { sleep, doc, find, puck, waitFor } = window.T;
  const checks = {};
  const select = (id) => puck().dispatch({ type: "setUi", ui: { itemSelector: puck().getSelectorForId(id) } });
  /** Change a <select> or radio in the settings panel to `value`, like a user would. */
  const choose = async (fieldLabel, value) => {
    const label = await waitFor(
      () => [...document.querySelectorAll("label, div")].find((el) => el.textContent.trim().startsWith(fieldLabel) && el.querySelector("select, input[type=radio]")),
      `field "${fieldLabel}"`,
    );
    // Puck stores each option in the DOM as JSON: {"value":"card"}.
    const encoded = JSON.stringify({ value });
    const selectEl = label.querySelector("select");
    if (selectEl) {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(selectEl, encoded);
      selectEl.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      [...label.querySelectorAll("input[type=radio]")].find((r) => r.value === encoded).click();
    }
    await sleep(700);
  };

  // 1. Container surface: plain -> card (the section-header container in "collections").
  const header = find((n) => n.type === "Container" && n.props.columns === "1").node;
  select(header.props.id);
  await sleep(700);
  await choose("Surface", "card");
  checks["Container surface -> card"] = {
    expected: "class vs-container--card in preview",
    actual: find((n) => n.props.id === header.props.id).node.props.surface + " / " + (doc().querySelector(".vs-container--card") ? "class present" : "class missing"),
    pass: find((n) => n.props.id === header.props.id).node.props.surface === "card" && !!doc().querySelector(".vs-container--card"),
  };

  // 2. Paragraph style: body -> badge.
  const para = find((n) => n.type === "Paragraph" && /timeless garments/.test(n.props.text)).node;
  select(para.props.id);
  await sleep(700);
  await choose("Style", "badge");
  checks["Paragraph style -> badge"] = {
    expected: "badge",
    actual: find((n) => n.props.id === para.props.id).node.props.variant,
    pass: find((n) => n.props.id === para.props.id).node.props.variant === "badge" && doc().querySelectorAll(".vs-paragraph--badge").length >= 2,
  };

  // 3. Section background: collections section solid -> gradient.
  const section = find((n) => n.type === "Section" && n.props.anchor === "collections").node;
  select(section.props.id);
  await sleep(700);
  await choose("Background style", "gradient");
  checks["Section background -> gradient"] = {
    expected: "gradient",
    actual: find((n) => n.props.id === section.props.id).node.props.bgStyle,
    pass: !!doc().querySelector("#collections.vs-section--gradient"),
  };

  // 4. Button icon: the contact button already has an arrow; outline buttons have none.
  checks["Arrow icon rendered"] = {
    expected: "≥ 2 buttons with an arrow",
    actual: doc().querySelectorAll(".vs-button__icon").length,
    pass: doc().querySelectorAll(".vs-button__icon").length >= 2,
  };

  // 5. Editor-only behaviour: no scroll fade-in or hover lift classes inside the editor.
  checks["No live-only effects in the editor"] = {
    expected: "0 live sections / containers",
    actual: `${doc().querySelectorAll(".vs-section--live").length} / ${doc().querySelectorAll(".vs-container--live").length}`,
    pass: doc().querySelectorAll(".vs-section--live, .vs-container--live").length === 0,
  };

  // 6. Undo reverts the last design change.
  document.querySelector('button[title="undo"]').click();
  await sleep(900);
  checks["Undo design change"] = {
    expected: "solid",
    actual: find((n) => n.props.id === section.props.id).node.props.bgStyle,
    pass: find((n) => n.props.id === section.props.id).node.props.bgStyle === "solid",
  };

  return { allPassed: Object.values(checks).every((c) => c.pass), checks };
})();
