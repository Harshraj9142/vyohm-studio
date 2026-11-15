// Part 1 of the persistence test: edit the headline and upload an image.
// Run part 2 (after-reload.js) with the SAME --profile to simulate closing and reopening the browser.
(async () => {
  const { sleep, doc, type, inputWithValue, uploadPng, find } = window.T;
  doc().querySelector("h1").click();
  await sleep(800);
  type(inputWithValue(doc().querySelector("h1").textContent), "Saved headline");
  await sleep(500);
  doc().querySelector(".vs-image__placeholder").click();
  await sleep(800);
  await uploadPng("PERSISTED PHOTO");
  await sleep(1500); // let autosave finish
  return {
    headline: find((n) => n.props.level === "h1").node.props.text,
    imageSrc: find((n) => n.type === "Image").node.props.src,
    saveStatus: document.querySelector(".ed-save")?.textContent,
  };
})();
