// Part 1 of the "old auto-saved sample" test: put the browser in the state older versions left
// behind (the sample page saved automatically, with no "sample chosen" flag). Run on /start.
(async () => {
  const page = JSON.parse(JSON.stringify(window.__fixture));
  page.root.props.title = "Loom & Line — Sample page"; // what the old auto-save stored
  const db = await new Promise((resolve, reject) => {
    const r = indexedDB.open("vyohm-studio", 1);
    r.onupgradeneeded = () => { r.result.createObjectStore("pages"); r.result.createObjectStore("assets", { keyPath: "id" }); };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  await new Promise((resolve) => {
    const tx = db.transaction("pages", "readwrite");
    tx.objectStore("pages").put({ data: page, savedAt: Date.now() }, "current");
    tx.objectStore("pages").delete("info");
    tx.oncomplete = resolve;
  });
  return "old auto-saved sample in place";
})();
