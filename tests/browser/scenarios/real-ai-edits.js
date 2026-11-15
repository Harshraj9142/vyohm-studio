// Two REAL Claude edits (small cost): a mobile-aware element edit and a whole-page edit.
(async () => {
  const { sleep, data, doc, type, viewport, find, diff, aiStatus, click, waitFor } = window.T;
  const checks = {};

  // 1. In the mobile preview, "make this heading smaller" should use a mobile-only override.
  viewport("Mobile").click();
  await sleep(1500);
  doc().querySelector("h1").click();
  await waitFor(() => document.querySelector(".ed-ai-target strong"), "selected heading");
  let before = JSON.parse(JSON.stringify(data()));
  type(document.querySelector("#ed-ai-instruction"), "Make this heading smaller");
  await click("Apply with AI");
  let s = await aiStatus("edit", 90000);
  let changes = diff(before, data());
  const h1 = find((n) => n.props.level === "h1").node.props;
  checks["Mobile-aware edit"] = {
    expected: "only the heading's mobile.fontSize changes; desktop 64px unchanged",
    actual: `${s.kind} (${s.seconds}s): ${JSON.stringify(changes)}; desktop ${h1.fontSize}px`,
    pass: s.kind.includes("ok") && changes.length === 1 && /mobile\.fontSize/.test(changes[0]) && h1.fontSize === 64,
  };

  // 2. Whole page: "make every button fully rounded".
  viewport("Desktop").click();
  await sleep(1000);
  document.querySelectorAll("input[name=ed-ai-scope]")[1]?.click();
  await sleep(200);
  before = JSON.parse(JSON.stringify(data()));
  type(document.querySelector("#ed-ai-instruction"), "Make every button on the page fully rounded (pill shaped)");
  await click("Apply with AI");
  s = await aiStatus("edit", 90000);
  changes = diff(before, data());
  checks["Whole-page edit"] = {
    expected: "only button radius values change",
    actual: `${s.kind} (${s.seconds}s): ${changes.length} change(s): ${JSON.stringify(changes)}`,
    pass: s.kind.includes("ok") && changes.length > 0 && changes.every((c) => /\.radius:/.test(c)),
  };
  return { allPassed: Object.values(checks).every((c) => c.pass), checks };
})();
