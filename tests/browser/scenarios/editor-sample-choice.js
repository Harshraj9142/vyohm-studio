// Welcome screen -> "Explore the sample page" opens the sample. Free.
(async () => {
  const { waitFor } = window.T;
  [...document.querySelectorAll("button")].find((b) => b.textContent.includes("Explore the sample page")).click();
  const h1 = await waitFor(() => document.querySelector("iframe")?.contentDocument?.querySelector("h1"), "sample page", 15000);
  const checks = {
    "Sample opens only when chosen": { expected: "Crafted to be kept.", actual: h1.textContent, pass: h1.textContent === "Crafted to be kept." },
  };
  return { allPassed: Object.values(checks).every((c) => c.pass), checks };
})();
