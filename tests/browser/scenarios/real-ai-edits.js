// Four REAL Claude edits (small cost): a mobile-aware element edit, a whole-page edit,
// moving the selected button to another column, and adding a hover effect.
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

  // 3. Selected element: "move this button to the right column" moves only that button.
  const hero = find((n) => n.type === "Container").node;
  const heroButtonId = hero.props.left.find((n) => n.type === "Button").props.id;
  const countOf = (type) => { let n = 0; find((x) => { if (x.type === type) n++; return false; }); return n; };
  const buttonsBefore = countOf("Button");
  doc().querySelector(`[data-puck-component="${heroButtonId}"]`).click();
  await waitFor(() => document.querySelector(".ed-ai-target strong"), "selected button");
  document.querySelectorAll("input[name=ed-ai-scope]")[0]?.click(); // "Selected"
  await sleep(200);
  const buttonProps = JSON.stringify(find((n) => n.props.id === heroButtonId).node.props);
  type(document.querySelector("#ed-ai-instruction"), "Move this button to the right column, under the image");
  await click("Apply with AI");
  s = await aiStatus("edit", 90000);
  const moved = find((n) => n.props.id === heroButtonId);
  checks["Selected button moved to the other column"] = {
    expected: `${hero.props.id}:right, button unchanged, same number of buttons`,
    actual: `${s.kind} (${s.seconds}s): ${moved.parent}:${moved.slot}`,
    pass: s.kind.includes("ok") && moved.parent === hero.props.id && moved.slot === "right" && JSON.stringify(moved.node.props) === buttonProps && countOf("Button") === buttonsBefore,
  };

  // 4. Selected element: "add a hover effect" sets the new hover setting and nothing else.
  doc().querySelector(`[data-puck-component="${heroButtonId}"]`).click();
  await sleep(700);
  before = JSON.parse(JSON.stringify(data()));
  type(document.querySelector("#ed-ai-instruction"), "Add a hover effect to this button");
  await click("Apply with AI");
  s = await aiStatus("edit", 90000);
  changes = diff(before, data());
  checks["Hover effect added by AI"] = {
    expected: "exactly one change: the button's hover",
    actual: `${s.kind} (${s.seconds}s): ${JSON.stringify(changes)}`,
    pass: s.kind.includes("ok") && changes.length === 1 && /\.hover: "default" -> "(lift|grow|glow|none)"/.test(changes[0]),
  };
  return { allPassed: Object.values(checks).every((c) => c.pass), checks };
})();
