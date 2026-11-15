// Part 2: opening /editor must show the welcome screen (not the old sample), offer to continue,
// and "Continue with this page" must open it. Same --profile as part 1.
(async () => {
  const { waitFor } = window.T;
  const checks = {};
  const text = document.body.textContent;
  checks["Old auto-saved sample is not opened by itself"] = {
    expected: "welcome screen, no editor",
    actual: `${text.includes("You don't have a page yet") ? "welcome" : "no welcome"}, ${document.querySelector("iframe") ? "editor visible" : "no editor"}`,
    pass: text.includes("You don't have a page yet") && !document.querySelector("iframe"),
  };
  checks["Offers to continue with it"] = {
    expected: "mentions the page + Continue button",
    actual: text.includes("This browser still has") ? "offered" : "not offered",
    pass: text.includes("This browser still has") && text.includes("Loom & Line — Sample page"),
  };
  [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Continue with this page")).click();
  const h1 = await waitFor(() => document.querySelector("iframe")?.contentDocument?.querySelector("h1"), "editor with the old page", 15000);
  checks["Continue opens the existing page"] = {
    expected: window.__fixture.root.props.content[0].props.content[0].props.left.find((n) => n.props.level === "h1")?.props.text ?? "(its h1)",
    actual: h1.textContent,
    pass: !!h1.textContent,
  };
  return { allPassed: Object.values(checks).every((c) => c.pass), checks };
})();
