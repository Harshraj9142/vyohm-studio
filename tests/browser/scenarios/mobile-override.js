// Mobile preview + a mobile-only style override, then undo/redo (free, no AI).
// Expected: phones get the override, desktop value unchanged, no horizontal overflow.
(async () => {
  const { sleep, doc, type, viewport, find } = window.T;
  const checks = {};

  viewport("Mobile").click();
  await sleep(1500);
  const iframe = document.querySelector("iframe");
  const fontSize = () => doc().defaultView.getComputedStyle(doc().querySelector("h1")).fontSize;
  checks["Mobile preview width"] = { expected: 390, actual: iframe.clientWidth };
  checks["Columns stack on phones"] = { expected: "1 column", actual: doc().defaultView.getComputedStyle(doc().querySelector(".vs-container")).gridTemplateColumns.split(" ").length === 1 ? "1 column" : "more" };
  checks["No horizontal overflow"] = { expected: false, actual: doc().documentElement.scrollWidth > doc().documentElement.clientWidth };
  checks["Default phone heading (75% of 64px)"] = { expected: "48px", actual: fontSize() };

  doc().querySelector("h1").click();
  await sleep(800);
  type(document.querySelector('input[placeholder="Same as desktop"]'), "30");
  await sleep(900);
  const h1 = () => find((n) => n.props.level === "h1").node.props;
  checks["Mobile override applied"] = { expected: "30px on phone, desktop 64", actual: `${fontSize()} on phone, desktop ${h1().fontSize}`, pass: fontSize() === "30px" && h1().fontSize === 64 };

  document.querySelector('button[title="undo"]').click();
  await sleep(900);
  const undone = h1().mobile?.fontSize ?? null;
  document.querySelector('button[title="redo"]').click();
  await sleep(900);
  checks["Undo / redo of mobile override"] = { expected: "null / 30", actual: `${undone} / ${h1().mobile?.fontSize}`, pass: undone === null && h1().mobile?.fontSize === 30 };

  viewport("Desktop").click();
  await sleep(1200);
  checks["Desktop unchanged"] = { expected: "64px", actual: fontSize() };

  for (const c of Object.values(checks)) if (c.pass === undefined) c.pass = JSON.stringify(c.expected) === JSON.stringify(c.actual);
  return { allPassed: Object.values(checks).every((c) => c.pass), checks };
})();
