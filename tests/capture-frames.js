const { chromium } = require("playwright");
const path = require("node:path");
const fs = require("node:fs");

const DIAGRAMS_DIR = path.join(__dirname, "..", "diagrams");
const FRAMES_DIR = path.join(DIAGRAMS_DIR, "frames");

async function captureFrames() {
  if (!fs.existsSync(FRAMES_DIR)) fs.mkdirSync(FRAMES_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });

  const htmlPath = path.join(DIAGRAMS_DIR, "animations.html");
  await page.goto("file://" + htmlPath);
  await page.waitForTimeout(1000);

  const diagrams = await page.$$(".diagram");
  console.log("Found", diagrams.length, "diagrams");

  for (let i = 0; i < diagrams.length; i++) {
    const dir = path.join(FRAMES_DIR, String(i + 1).padStart(2, "0"));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Scroll to diagram and wait for animation
    await diagrams[i].scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);

    // Capture 8 frames of the animation
    for (let f = 0; f < 8; f++) {
      await page.screenshot({
        path: path.join(dir, `frame-${String(f).padStart(3, "0")}.png`),
        clip: await diagrams[i].boundingBox(),
      });
      await page.waitForTimeout(150);
    }
    console.log(`Diagram ${i + 1}: 8 frames captured`);
  }

  await browser.close();
  console.log("All frames captured in", FRAMES_DIR);
}

captureFrames().catch((e) => { console.error(e); process.exit(1); });
