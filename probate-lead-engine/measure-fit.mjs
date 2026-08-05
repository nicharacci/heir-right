import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1830, height: 964 } });
await page.goto("http://localhost:4173/?view=dossiers", { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

const report = await page.evaluate(() => {
  const pick = (selector) => {
    const node = document.querySelector(selector);
    if (!node) return { selector, missing: true };
    const rect = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return {
      selector,
      top: Math.round(rect.top),
      bottom: Math.round(rect.bottom),
      height: Math.round(rect.height),
      width: Math.round(rect.width),
      scrollH: node.scrollHeight,
      clientH: node.clientHeight,
      scrollW: node.scrollWidth,
      clientW: node.clientWidth,
      overflow: `${style.overflowX}/${style.overflowY}`,
      padding: style.padding,
    };
  };
  return {
    viewport: { w: innerWidth, h: innerHeight },
    docScrollH: document.documentElement.scrollHeight,
    nodes: [
      ".app",
      ".content",
      ".workbench",
      "#dossiersView",
      ".s40-docprep",
      ".s40-workbench",
      ".s40-selector",
      ".s40-artifact-rail",
    ].map(pick),
  };
});

console.log(JSON.stringify(report, null, 2));
await browser.close();
