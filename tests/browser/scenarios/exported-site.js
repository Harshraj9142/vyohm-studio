// Checks the EXPORTED site (run against `npm run start` of the extracted ZIP) at any width.
(() => {
  const h1 = document.querySelector("h1");
  const img = document.querySelector("img.vs-image__media");
  return {
    width: innerWidth,
    title: document.title,
    h1: h1?.textContent,
    h1FontSize: h1 && getComputedStyle(h1).fontSize,
    firstButton: (() => {
      const a = document.querySelector("a.vs-button");
      return a && { label: a.textContent, href: a.getAttribute("href"), background: getComputedStyle(a).backgroundColor };
    })(),
    uploadedImage: img && { src: img.getAttribute("src"), loaded: img.complete && img.naturalWidth > 0 },
    sections: [...document.querySelectorAll("section")].map((s) => s.id),
    columnsInFirstContainer: getComputedStyle(document.querySelector(".vs-container")).gridTemplateColumns.split(" ").length,
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
    designOptions: {
      liveSections: document.querySelectorAll(".vs-section--live").length, // scroll fade-in enabled
      surfaces: [...document.querySelectorAll(".vs-container--surface")].map((c) => [...c.classList].find((x) => /--(card|glow|outline)$/.test(x))),
      paragraphStyles: [...document.querySelectorAll("[class*='vs-paragraph--']")].length,
      arrowButtons: document.querySelectorAll(".vs-button__icon").length,
    },
  };
})();
