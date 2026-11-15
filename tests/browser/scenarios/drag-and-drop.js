// REAL mouse drag-and-drop (Chrome input events via cdp.mjs `__drags`). Free.
//  4. Press on text and drag (no handle)                        -> nothing moves; a hint points to the ⠿ handle
//  5. Drag the same paragraph by its ⠿ handle                    -> it moves to the other column
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

  // Click an element (to show its toolbar), then return the centre of its ⠿ drag handle.
  window.__dndHandle = async (id) => {
    const iframe = document.querySelector("iframe");
    const el = iframe.contentDocument.querySelector(`[data-puck-component="${id}"]`);
    el.click();
    await waitFor(() => window.T.puck().selectedItem?.props.id === id, "element to be selected");
    await sleep(500);
    // Several toolbars can exist (hovered + selected): take the handle nearest to this element.
    const box = el.getBoundingClientRect();
    const handles = [...iframe.contentDocument.querySelectorAll("[data-puck-drag-handle]"), ...document.querySelectorAll("[data-puck-drag-handle]")];
    const handle = handles.sort((a, b) => {
      const d = (h) => { const r = h.getBoundingClientRect(); return Math.hypot(r.left - box.right, r.top - box.top); };
      return d(a) - d(b);
    })[0];
    if (!handle) throw new Error("No drag handle found");
    const r = handle.getBoundingClientRect();
    if (handle.ownerDocument === document) return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
    const f = iframe.getBoundingClientRect();
    const scale = f.width / iframe.clientWidth;
    return { x: Math.round(f.left + (r.left + r.width / 2) * scale), y: Math.round(f.top + (r.top + r.height / 2) * scale) };
  };

  const hero = find((n) => n.type === "Container").node; // first container = hero
  const button = find((n) => n.type === "Button" && n.props.label === "View collection");
  const card = find((n) => n.type === "Container" && n.props.surface === "glow");
  const para = hero.props.left.find((n) => n.type === "Paragraph" && n.props.variant !== "badge");
  window.__dnd = {
    heroId: hero.props.id,
    buttonId: button.node.props.id,
    cardId: card.node.props.id,
    cardParent: card.parent,
    paraId: para.props.id,
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
      {
        // 4. pressing on TEXT and dragging places the cursor instead (Puck's inline editing):
        //    nothing moves, and a hint points to the ⠿ handle
        from: `(window.__dndTop(), window.__dndPoint('[data-puck-component="${para.props.id}"]'))`,
        to: `window.__dndPoint('[data-puck-dropzone="${hero.props.id}:right"]', 0.5, 0.9)`,
        during: `(() => { const t = ${toast}; return { checks: {
          "Dragging on text shows the handle hint": { expected: "To move text, drag the ⠿ handle…", actual: t, pass: !!t && t.startsWith("To move text, drag the ⠿ handle") } } }; })()`,
        after: `(() => { const parent = ${parentOf("window.__dnd.paraId")}; return { checks: {
          "Text drag without the handle moves nothing": { expected: window.__dnd.heroId + " (left column)", actual: parent, pass: parent === window.__dnd.heroId && window.T.find((n) => n.props.id === window.__dnd.paraId).slot === "left" } } }; })()`,
      },
      {
        // 5. the same paragraph, dragged by the ⠿ handle in its toolbar -> the image column
        from: `window.__dndHandle(${JSON.stringify(para.props.id)})`,
        to: `window.__dndPoint('[data-puck-dropzone="${hero.props.id}:right"]', 0.5, 0.9)`,
        after: `(() => { const hit = window.T.find((n) => n.props.id === window.__dnd.paraId); return { checks: {
          "Paragraph moves to the other column with the ⠿ handle": { expected: window.__dnd.heroId + ":right", actual: hit.parent + ":" + hit.slot, pass: hit.parent === window.__dnd.heroId && hit.slot === "right" } } }; })()`,
      },
    ],
  };
})();
