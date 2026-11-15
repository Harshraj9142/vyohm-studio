// REAL mouse drag-and-drop (Chrome input events via cdp.mjs `__drags`). Free.
//  1. Move a button into another container (allowed)           -> it moves, no warning
//  2. Drag a new Section from the Blocks panel onto a column    -> red outline + message while dragging;
//     afterwards a message that matches what Puck actually did (placed elsewhere, or not moved)
//  3. Drag an existing Container into another container column -> message while dragging; not nested
(async () => {
  const { sleep, data, find, waitFor } = window.T;

  // Open the Blocks panel (the AI tab is open by default; rail tabs are divs, not buttons).
  [...document.querySelectorAll("[class*='NavItem-link']")].find((el) => el.textContent.trim() === "Blocks")?.click();
  await waitFor(() => document.querySelector('[data-testid="drawer-item:Section"]')?.getBoundingClientRect().width, "Blocks panel");
  await sleep(500);

  // Helpers used inside the drag expressions (evaluated later, after earlier drags changed the layout).
  window.__dndPoint = (selector, fx = 0.5, fy = 0.5) => {
    const iframe = document.querySelector("iframe");
    const el = iframe.contentDocument.querySelector(selector);
    const f = iframe.getBoundingClientRect();
    const scale = f.width / iframe.clientWidth;
    const r = el.getBoundingClientRect();
    return { x: Math.round(f.left + (r.left + r.width * fx) * scale), y: Math.round(f.top + (r.top + r.height * fy) * scale) };
  };
  window.__dndTop = () => document.querySelector("iframe").contentWindow.scrollTo(0, 0);
  window.__dndMain = (selector) => {
    const r = document.querySelector(selector).getBoundingClientRect();
    return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
  };

  const hero = find((n) => n.type === "Container").node; // first container = hero
  const button = find((n) => n.type === "Button" && n.props.label === "View collection");
  const card = find((n) => n.type === "Container" && n.props.surface === "glow");
  window.__dnd = {
    heroId: hero.props.id,
    buttonId: button.node.props.id,
    cardId: card.node.props.id,
    cardParent: card.parent,
    sections: data().root.props.content.length,
  };

  const toast = `(document.querySelector(".ed-drop-toast")?.textContent ?? null)`;
  const blockedZone = `(document.querySelector("iframe").contentDocument.querySelector("[data-vs-blocked]")?.getAttribute("data-puck-dropzone") ?? null)`;
  const parentOf = (idExpr) => `(window.T.find((n) => n.props.id === ${idExpr})?.parent ?? null)`;
  const sectionsInsideContainers = `(() => { let bad = 0; window.T.find((n) => { if (n.type === "Container") for (const k of ["left", "right"]) bad += (n.props[k] || []).filter((c) => c.type !== "Heading" && c.type !== "Paragraph" && c.type !== "Image" && c.type !== "Button").length; return false; }); return bad; })()`;

  return {
    setup: window.__dnd,
    __drags: [
      {
        // 1. allowed: button -> bottom of the hero's left column
        from: `window.__dndPoint('[data-puck-component="${button.node.props.id}"]')`,
        to: `window.__dndPoint('[data-puck-dropzone="${hero.props.id}:left"]', 0.3, 0.97)`,
        after: `(() => { const parent = ${parentOf("window.__dnd.buttonId")}; return { checks: {
          "Real mouse drag moves a button into another container": { expected: window.__dnd.heroId, actual: parent, pass: parent === window.__dnd.heroId },
          "No warning for an allowed drop": { expected: null, actual: ${toast}, pass: ${toast} === null } } }; })()`,
      },
      {
        // 2. refused: new Section from the Blocks panel -> hero's right column
        from: `window.__dndMain('[data-testid="drawer-item:Section"]')`,
        to: `window.__dndPoint('[data-puck-dropzone="${hero.props.id}:right"]')`,
        during: `(() => { const t = ${toast}; const z = ${blockedZone}; return { checks: {
          "Message while dragging a Section over a column": { expected: "Can't drop a Section here…", actual: t, pass: !!t && t.startsWith("Can't drop a Section here") },
          "Refused drop area outlined in red": { expected: window.__dnd.heroId + ":right", actual: z, pass: z === window.__dnd.heroId + ":right" } } }; })()`,
        after: `(async () => { const t = ${toast}; const added = window.T.data().root.props.content.length !== window.__dnd.sections; const bad = ${sectionsInsideContainers}; const outline = ${blockedZone};
          // Undo the placement (if any) so the next drag sees the original layout; this also checks Undo.
          if (added) { document.querySelector('button[title="undo"]').click(); await window.T.sleep(900); }
          const undone = window.T.data().root.props.content.length === window.__dnd.sections;
          return { checks: {
          "Message after letting go matches what happened": { expected: "added elsewhere -> 'Placed on the page instead…' / unchanged -> 'Not moved…'", actual: (added ? "added on the page: " : "unchanged: ") + t, pass: !!t && (added ? t.startsWith("Placed on the page instead") : t.startsWith("Not moved")) },
          "Nothing invalid inside any container": { expected: 0, actual: bad, pass: bad === 0 },
          "Red outline removed": { expected: null, actual: outline, pass: outline === null },
          "Undo takes the dropped Section back": { expected: window.__dnd.sections + " sections", actual: window.T.data().root.props.content.length + " sections", pass: undone } } }; })()`,
      },
      {
        // 3. refused: existing collection card (Container) -> hero's right column
        from: `(window.__dndTop(), window.__dndPoint('[data-puck-component="${card.node.props.id}"]', 0.5, 0.05))`,
        to: `window.__dndPoint('[data-puck-dropzone="${hero.props.id}:right"]')`,
        during: `(() => { const t = ${toast}; return { checks: {
          "Message while dragging a Container into a container": { expected: "Can't drop a Container here…", actual: t, pass: !!t && t.startsWith("Can't drop a Container here") } } }; })()`,
        after: `(() => { const parent = ${parentOf("window.__dnd.cardId")}; const bad = ${sectionsInsideContainers}; return { checks: {
          "Container not nested inside the other container": { expected: "still inside a section", actual: parent, pass: !!parent && parent.startsWith("Section-") },
          "Still nothing invalid inside containers": { expected: 0, actual: bad, pass: bad === 0 } } }; })()`,
      },
    ],
  };
})();
