// Failure and concurrency tests for the AI features, with FAKE responses (no Claude calls, free).
// Run with: --fixture tests/browser/fixtures/generated-page.json
(async () => {
  const { sleep, data, doc, type, inputWithValue, find, aiStatus, mockFetch, restoreFetch, waitFor, click } = window.T;
  const checks = {};
  const h1 = () => doc().querySelector("h1")?.textContent;
  const json = () => JSON.stringify(data());

  // 1. Malformed generated page -> rejected, page unchanged.
  let before = json();
  mockFetch(() => ({ data: { root: { props: { title: "x", content: [{ type: "Script", props: { id: "a" } }] } }, content: [] } }));
  type(document.querySelector("#ed-ai-brief"), "Malformed response test for a shop");
  await sleep(100);
  await click("Generate page");
  let s = await aiStatus("generate", 10000);
  checks["Malformed AI page rejected"] = { expected: "error, page unchanged", actual: `${s.kind}: ${s.text}`, pass: s.kind.includes("error") && json() === before };

  // 2. User edits the page while generation is pending -> asks before replacing.
  mockFetch(() => ({ data: window.__fixture }), { delay: 3000 });
  await click("Generate page");
  await sleep(800);
  type(await waitFor(() => inputWithValue("Loom & Line — Sample page"), "page title field"), "Edited during generation");
  s = await aiStatus("generate", 10000);
  const kept = !!inputWithValue("Edited during generation");
  if (s.kind.includes("warn")) await click("Keep my page", s.el);
  await sleep(300);
  checks["Edit during generation -> conflict prompt"] = { expected: "warning, manual edit kept", actual: `${s.kind}: ${s.text.slice(0, 80)}`, pass: s.kind.includes("warn") && kept };

  // 3. Generation is undoable (fake response, no delay).
  mockFetch(() => ({ data: window.__fixture }));
  const h1Before = h1();
  await click("Generate page");
  await aiStatus("generate", 10000);
  const h1Generated = h1();
  await sleep(500);
  document.querySelector('button[title="undo"]').click();
  await waitFor(() => h1() === h1Before, "undo to restore the old page", 4000).catch(() => {});
  const h1Undo = h1();
  document.querySelector('button[title="redo"]').click();
  await waitFor(() => h1() === h1Generated, "redo to restore the generated page", 4000).catch(() => {});
  checks["Generate -> undo -> redo"] = { expected: "old / new / new", actual: `${h1Before} / ${h1Undo} / ${h1()}`, pass: h1Undo === h1Before && h1() === h1Generated && h1Generated !== h1Before };
  document.querySelector('button[title="undo"]').click(); // back to the starter page
  await waitFor(() => h1() === h1Before, "undo back to the starter page", 4000);

  // 4. User edits the SAME button while an AI edit is pending -> conflict prompt; "Apply anyway" keeps both.
  const cta = () => [...doc().querySelectorAll("a.vs-button")].find((a) => /Explore|Shop/.test(a.textContent));
  (await waitFor(cta, "hero button")).click();
  await waitFor(() => inputWithValue("Explore the collections"), "button fields");
  mockFetch((body) => ({ summary: "fake edit", operations: [{ op: "update", id: body.scope.id, changes: [{ prop: "bgColor", value: "#2563eb" }] }] }), { delay: 2500 });
  type(document.querySelector("#ed-ai-instruction"), "make it blue");
  await sleep(100);
  await click("Apply with AI");
  await sleep(600);
  type(await waitFor(() => inputWithValue("Explore the collections"), "button label field"), "Shop the collections");
  s = await aiStatus("edit", 10000);
  const untouched = find((n) => n.props.label === "Shop the collections").node.props.bgColor;
  await click("Apply anyway", s.el);
  await sleep(600);
  const merged = find((n) => n.props.label === "Shop the collections").node.props;
  checks["Edit same element during AI edit"] = {
    expected: "warning; nothing applied until confirmed; then label + blue",
    actual: `${s.kind}; before confirm bg=${untouched}; after: "${merged.label}" bg=${merged.bgColor}`,
    pass: s.kind.includes("warn") && untouched === "#c9a44c" && merged.bgColor === "#2563eb",
  };

  // 5. AI tries to change something outside the selection -> rejected.
  (await waitFor(cta, "hero button")).click();
  await waitFor(() => document.querySelector(".ed-ai-target strong"), "selected element label");
  before = json();
  const h1Id = find((n) => n.props.level === "h1").node.props.id;
  mockFetch(() => ({ summary: "fake", operations: [{ op: "update", id: h1Id, changes: [{ prop: "text", value: "HACKED" }] }] }));
  type(document.querySelector("#ed-ai-instruction"), "change the headline");
  await sleep(100);
  await click("Apply with AI");
  s = await aiStatus("edit", 10000);
  checks["Out-of-scope AI edit rejected"] = { expected: "error, page unchanged", actual: `${s.kind}: ${s.text.slice(0, 110)}`, pass: s.kind.includes("error") && json() === before };

  // 6. AI sends an unsafe value -> rejected.
  mockFetch((body) => ({ summary: "fake", operations: [{ op: "update", id: body.scope.id, changes: [{ prop: "bgColor", value: "javascript:alert(1)" }] }] }));
  await click("Apply with AI");
  s = await aiStatus("edit", 10000);
  checks["Unsafe AI value rejected"] = { expected: "error, page unchanged", actual: `${s.kind}: ${s.text.slice(0, 90)}`, pass: s.kind.includes("error") && json() === before };

  // 6b. AI "clears" a setting that needs a value (seen once: it sent href: null when it
  //     could not name the setting it meant) -> rejected instead of silently breaking the link.
  mockFetch((body) => ({ summary: "fake", operations: [{ op: "update", id: body.scope.id, changes: [{ prop: "href", value: null }] }] }));
  await click("Apply with AI");
  s = await aiStatus("edit", 10000);
  checks["AI clearing a required setting rejected"] = { expected: "error (needs a value), page unchanged", actual: `${s.kind}: ${s.text.slice(0, 110)}`, pass: s.kind.includes("error") && /needs a value/.test(s.text) && json() === before };

  // 7. Server error -> readable message, page unchanged.
  mockFetch(() => ({ error: "Claude is busy (rate limit). Please wait a moment and try again." }), { status: 429 });
  await click("Apply with AI");
  s = await aiStatus("edit", 10000);
  checks["API error shown, page unchanged"] = { expected: "error message", actual: `${s.kind}: ${s.text.slice(0, 90)}`, pass: s.kind.includes("error") && json() === before };

  // 8. AI breaks the nesting rules (a Section inside a Container) -> rejected.
  (await waitFor(() => doc().querySelector(".vs-container"), "a container")); // page has containers
  const container = find((n) => n.type === "Container").node;
  document.querySelector("input[name=ed-ai-scope][type=radio]:not(:checked)")?.click(); // "Whole page"
  await sleep(200);
  mockFetch(() => ({
    summary: "fake",
    operations: [{ op: "insert", parentId: container.props.id, slot: "left", index: 0, element: JSON.stringify({ type: "Section", anchor: "x", children: [] }) }],
  }));
  await click("Apply with AI");
  s = await aiStatus("edit", 10000);
  checks["Invalid nesting from AI rejected"] = { expected: "error, page unchanged", actual: `${s.kind}: ${s.text.slice(0, 90)}`, pass: s.kind.includes("error") && json() === before };

  restoreFetch();
  return { allPassed: Object.values(checks).every((c) => c.pass), checks };
})();
