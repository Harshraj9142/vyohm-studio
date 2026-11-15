// The Vyohm Studio landing page ("/"), at any width. Free.
(() => {
  const link = (text) => [...document.querySelectorAll("a")].find((a) => a.textContent.trim().startsWith(text));
  const demoCanvas = document.querySelector("[class*='canvas']");
  const checks = {
    "Hero headline": {
      expected: "Describe your business…",
      actual: document.querySelector("h1")?.textContent.replace(/\s+/g, " ").trim(),
      pass: /^Describe your business\./.test(document.querySelector("h1")?.textContent ?? ""),
    },
    "Get started goes to the chat": { expected: "/start", actual: link("Get started")?.getAttribute("href"), pass: link("Get started")?.getAttribute("href") === "/start" },
    "Open the editor goes to the editor": { expected: "/editor", actual: link("Open the editor")?.getAttribute("href"), pass: link("Open the editor")?.getAttribute("href") === "/editor" },
    "Feature cards": { expected: 6, actual: document.querySelectorAll("#features h3").length, pass: document.querySelectorAll("#features h3").length === 6 },
    "How-it-works steps": { expected: 3, actual: document.querySelectorAll("#how li").length, pass: document.querySelectorAll("#how li").length === 3 },
    "Hero demo is decorative (hidden from screen readers)": {
      expected: "aria-hidden=true",
      actual: demoCanvas?.closest("[aria-hidden]")?.getAttribute("aria-hidden"),
      pass: demoCanvas?.closest("[aria-hidden]")?.getAttribute("aria-hidden") === "true",
    },
    "No horizontal overflow": {
      expected: false,
      actual: document.documentElement.scrollWidth > innerWidth,
      pass: document.documentElement.scrollWidth <= innerWidth,
    },
  };
  return { width: innerWidth, allPassed: Object.values(checks).every((c) => c.pass), checks };
})();
