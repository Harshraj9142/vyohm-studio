// The "Get started" chat (/start) with a FAKE AI response (free). Run on /start with
//   --fixture tests/browser/fixtures/generated-page.json
// Checks: compose -> build animation -> real-page preview -> "Open in editor" saves the
// page and opens /editor with it.
(async () => {
  const { sleep, type, waitFor, mockFetch, restoreFetch } = window.T;
  const checks = {};
  const fixtureH1 = (() => {
    let h = null;
    const walk = (l) => l.forEach((n) => { if (!h && n.props.level === "h1") h = n.props.text; for (const k of ["content", "left", "right"]) if (Array.isArray(n.props[k])) walk(n.props[k]); });
    walk(window.__fixture.root.props.content);
    return h;
  })();

  // 1. Compose: intro message, example chips, composer.
  checks["Intro + example chips"] = {
    expected: "intro text and 4 chips",
    actual: `${!!document.body.textContent.includes("create your")} / ${document.querySelectorAll("button[class*='chip']").length} chips`,
    pass: document.body.textContent.includes("create your") && document.querySelectorAll("button[class*='chip']:not([class*='style'])").length >= 4,
  };
  const textarea = document.querySelector("#vs-brief");
  const send = () => document.querySelector("button[type=submit]");
  type(textarea, "short");
  await sleep(100);
  checks["Send disabled for a too-short brief"] = { expected: true, actual: send().disabled, pass: send().disabled === true };

  // 2. Build: fake answer after 6 s; the animation should show progress meanwhile.
  mockFetch(() => ({ data: window.__fixture }), { delay: 6000 });
  [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Bakery").click();
  await sleep(100);
  [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Warm & friendly").click();
  await sleep(100);
  send().click();
  await sleep(5500);
  const doneSteps = document.querySelectorAll("li[class*='step_done']").length;
  checks["Build animation progresses"] = {
    expected: "status visible, ≥1 step done, user brief shown with style",
    actual: `${!!document.querySelector("[role=status]")}, ${doneSteps} done, brief ends: "${[...document.querySelectorAll("[class*='bubbleUser']")].pop()?.textContent.slice(-28)}"`,
    pass: !!document.querySelector("[role=status]") && doneSteps >= 1 && /Style: Warm & friendly\.$/.test([...document.querySelectorAll("[class*='bubbleUser']")].pop()?.textContent ?? ""),
  };

  // 3. Ready: preview renders the REAL page.
  const preview = await waitFor(() => document.querySelector("[class*='previewFrame'] h1"), "preview of the generated page", 15000);
  checks["Preview shows the generated page"] = { expected: fixtureH1, actual: preview.textContent, pass: preview.textContent === fixtureH1 };
  checks["Ready message"] = {
    expected: "Your page is ready + Open in editor",
    actual: `${document.body.textContent.includes("Your page is ready")} / ${!![...document.querySelectorAll("button")].find((b) => b.textContent.includes("Open in editor"))}`,
    pass: document.body.textContent.includes("Your page is ready") && !![...document.querySelectorAll("button")].find((b) => b.textContent.includes("Open in editor")),
  };
  restoreFetch();

  // 4. Open in editor: page saved, editor opens with it.
  [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Open in editor")).click();
  const editorH1 = await waitFor(() => document.querySelector("iframe")?.contentDocument?.querySelector("h1"), "editor preview with the page", 20000);
  checks["Editor opens with the generated page"] = { expected: `${fixtureH1} at /editor`, actual: `${editorH1.textContent} at ${location.pathname}`, pass: editorH1.textContent === fixtureH1 && location.pathname === "/editor" };
  return { allPassed: Object.values(checks).every((c) => c.pass), checks };
})();
