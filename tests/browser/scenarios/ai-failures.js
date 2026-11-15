// Failure and concurrency tests for the AI features, with FAKE responses (no Claude calls, free).
// Run with: --fixture tests/browser/fixtures/generated-page.json
(async () => {
  const { sleep, data, doc, type, inputWithValue, button, find, aiStatus, mockFetch, restoreFetch } = window.T;
  const checks = {};
  const h1 = () => doc().querySelector("h1")?.textContent;
  const json = () => JSON.stringify(data());

  // 1. Malformed generated page -> rejected, page unchanged.
  let before = json();
  mockFetch(() => ({ data: { root: { props: { title: "x", content: [{ type: "Script", props: { id: "a" } }] } }, content: [] } }));
  type(document.querySelector("#ed-ai-brief"), "Malformed response test for a shop");
  await sleep(100);
  button("Generate page").click();
  let s = await aiStatus("generate", 10000);
  checks["Malformed AI page rejected"] = { expected: "error, page unchanged", actual: `${s.kind}: ${s.text}`, pass: s.kind.includes("error") && json() === before };

  // 2. User edits the page while generation is pending -> asks before replacing.
  mockFetch(() => ({ data: window.__fixture }), { delay: 3000 });
  button("Generate page").click();
  await sleep(800);
  type(inputWithValue("Loom & Line — Sample page"), "Edited during generation");
  s = await aiStatus("generate", 10000);
  const kept = !!inputWithValue("Edited during generation");
  [...s.el.querySelectorAll("button")].find((b) => b.textContent === "Keep my page").click();
  await sleep(300);
  checks["Edit during generation -> conflict prompt"] = { expected: "warning, manual edit kept", actual: `${s.kind}: ${s.text.slice(0, 80)}`, pass: s.kind.includes("warn") && kept };

  // 3. Generation is undoable (fake response, no delay).
  mockFetch(() => ({ data: window.__fixture }));
  const h1Before = h1();
  button("Generate page").click();
  await aiStatus("generate", 10000);
  const h1Generated = h1();
  await sleep(500);
  document.querySelector('button[title="undo"]').click();
  await sleep(900);
  const h1Undo = h1();
  document.querySelector('button[title="redo"]').click();
  await sleep(900);
  checks["Generate -> undo -> redo"] = { expected: "old / new / new", actual: `${h1Before} / ${h1Undo} / ${h1()}`, pass: h1Undo === h1Before && h1() === h1Generated && h1Generated !== h1Before };
  document.querySelector('button[title="undo"]').click(); // back to the starter page
  await sleep(900);

  // 4. User edits the SAME button while an AI edit is pending -> conflict prompt; "Apply anyway" keeps both.
  const cta = () => [...doc().querySelectorAll("a.vs-button")].find((a) => /Explore|Shop/.test(a.textContent));
  cta().click();
  await sleep(700);
  mockFetch((body) => ({ summary: "fake edit", operations: [{ op: "update", id: body.scope.id, changes: [{ prop: "bgColor", value: "#2563eb" }] }] }), { delay: 2500 });
  type(document.querySelector("#ed-ai-instruction"), "make it blue");
  await sleep(100);
  button("Apply with AI").click();
  await sleep(600);
  type(inputWithValue("Explore the collections"), "Shop the collections");
  s = await aiStatus("edit", 10000);
  const untouched = find((n) => n.props.label === "Shop the collections").node.props.bgColor;
  [...s.el.querySelectorAll("button")].find((b) => b.textContent === "Apply anyway").click();
  await sleep(600);
  const merged = find((n) => n.props.label === "Shop the collections").node.props;
  checks["Edit same element during AI edit"] = {
    expected: "warning; nothing applied until confirmed; then label + blue",
    actual: `${s.kind}; before confirm bg=${untouched}; after: "${merged.label}" bg=${merged.bgColor}`,
    pass: s.kind.includes("warn") && untouched === "#c9a44c" && merged.bgColor === "#2563eb",
  };

  // 5. AI tries to change something outside the selection -> rejected.
  cta().click();
  await sleep(700);
  before = json();
  const h1Id = find((n) => n.props.level === "h1").node.props.id;
  mockFetch(() => ({ summary: "fake", operations: [{ op: "update", id: h1Id, changes: [{ prop: "text", value: "HACKED" }] }] }));
  type(document.querySelector("#ed-ai-instruction"), "change the headline");
  await sleep(100);
  button("Apply with AI").click();
  s = await aiStatus("edit", 10000);
  checks["Out-of-scope AI edit rejected"] = { expected: "error, page unchanged", actual: `${s.kind}: ${s.text.slice(0, 110)}`, pass: s.kind.includes("error") && json() === before };

  // 6. AI sends an unsafe value -> rejected.
  mockFetch((body) => ({ summary: "fake", operations: [{ op: "update", id: body.scope.id, changes: [{ prop: "bgColor", value: "javascript:alert(1)" }] }] }));
  button("Apply with AI").click();
  s = await aiStatus("edit", 10000);
  checks["Unsafe AI value rejected"] = { expected: "error, page unchanged", actual: `${s.kind}: ${s.text.slice(0, 90)}`, pass: s.kind.includes("error") && json() === before };

  // 7. Server error -> readable message, page unchanged.
  mockFetch(() => ({ error: "Claude is busy (rate limit). Please wait a moment and try again." }), { status: 429 });
  button("Apply with AI").click();
  s = await aiStatus("edit", 10000);
  checks["API error shown, page unchanged"] = { expected: "error message", actual: `${s.kind}: ${s.text.slice(0, 90)}`, pass: s.kind.includes("error") && json() === before };

  restoreFetch();
  return { allPassed: Object.values(checks).every((c) => c.pass), checks };
})();
