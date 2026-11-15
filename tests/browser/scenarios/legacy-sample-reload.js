// Part 3: after choosing "Continue", a reload opens the page directly (same --profile).
(() => {
  const opened = !!document.querySelector("iframe");
  const checks = {
    "After choosing it, reload opens the page directly": { expected: "editor", actual: opened ? "editor" : "welcome", pass: opened },
  };
  return { allPassed: Object.values(checks).every((c) => c.pass), checks };
})();
