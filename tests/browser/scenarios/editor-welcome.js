// Opening /editor with no saved page shows a choice (never a page the user didn't ask for).
// Then "Start from a blank page". Free.
(async () => {
  const { sleep, waitFor } = window.T;
  const checks = {};
  const text = document.body.textContent;
  const generate = [...document.querySelectorAll("a")].find((a) => a.textContent.includes("Generate with AI"));
  checks["Welcome screen instead of a sample page"] = {
    expected: "welcome text, no editor preview",
    actual: `${text.includes("You don't have a page yet") ? "welcome shown" : "no welcome"}, ${document.querySelector("iframe") ? "editor visible" : "no editor"}`,
    pass: text.includes("You don't have a page yet") && !document.querySelector("iframe"),
  };
  checks["Three choices; Generate goes to the chat"] = {
    expected: "Generate (/start), Blank, Sample",
    actual: `${generate?.getAttribute("href")}, ${text.includes("Start from a blank page")}, ${text.includes("Explore the sample page")}`,
    pass: generate?.getAttribute("href") === "/start" && text.includes("Start from a blank page") && text.includes("Explore the sample page"),
  };
  [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Start from a blank page")).click();
  await waitFor(() => document.querySelector("iframe")?.contentDocument?.querySelector("[data-puck-dropzone]"), "blank editor", 15000);
  await sleep(1200);
  const sections = window.__vsPuck().appState.data.root.props.content.length;
  checks["Blank page opens empty in the editor"] = {
    expected: "0 sections, Blocks tab, saved",
    actual: `${sections} sections, tab ${window.__vsPuck().appState.ui.plugin?.current}, ${document.querySelector(".ed-save")?.textContent}`,
    pass: sections === 0 && window.__vsPuck().appState.ui.plugin?.current === "blocks" && /^Saved/.test(document.querySelector(".ed-save")?.textContent ?? ""),
  };
  return { allPassed: Object.values(checks).every((c) => c.pass), checks };
})();
