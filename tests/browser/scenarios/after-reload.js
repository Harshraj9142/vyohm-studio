// Part 2 of the persistence test (same --profile as upload-persist.js).
(async () => {
  const { doc, find } = window.T;
  const img = doc().querySelector("img.vs-image__media");
  const checks = {
    "Headline restored": { expected: "Saved headline", actual: find((n) => n.props.level === "h1").node.props.text },
    "Image reference saved (not a blob: URL)": { expected: "asset:…", actual: find((n) => n.type === "Image").node.props.src },
    "Uploaded image visible after reload": { expected: true, actual: !!img && img.complete && img.naturalWidth > 0 },
  };
  checks["Headline restored"].pass = checks["Headline restored"].actual === "Saved headline";
  checks["Image reference saved (not a blob: URL)"].pass = /^asset:[a-z0-9]+$/.test(checks["Image reference saved (not a blob: URL)"].actual);
  checks["Uploaded image visible after reload"].pass = checks["Uploaded image visible after reload"].actual === true;
  return { allPassed: Object.values(checks).every((c) => c.pass), checks };
})();
