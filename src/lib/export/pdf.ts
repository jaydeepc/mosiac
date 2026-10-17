import { createPrintToken } from "@/lib/print-token";

/**
 * Renders the resume to a two-page A4 PDF with headless Chrome by opening the app's own
 * /print/[id] page (same React component as the screen). If the content spills past two
 * pages, the type is scaled down a little and rendered again.
 */
export async function resumeToPdf(origin: string, projectId: string, which: "main" | "second"): Promise<Buffer> {
  const puppeteer = (await import("puppeteer")).default;
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--font-render-hinting=none"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    const token = await createPrintToken(projectId, which);
    let scale = 1;
    let pdf: Uint8Array | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const url = `${origin}/print/${projectId}?token=${encodeURIComponent(token)}&scale=${scale.toFixed(2)}`;
      await page.goto(url, { waitUntil: "networkidle0", timeout: 90_000 });
      await page.evaluate(() => (document as unknown as { fonts: { ready: Promise<void> } }).fonts.ready);
      const height = await page.evaluate(() => document.getElementById("print-root")?.scrollHeight ?? document.documentElement.scrollHeight);
      const pages = Math.ceil(height / 1123);
      pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
      if (pages <= 2) break;
      scale = Math.max(0.72, scale - 0.07);
    }
    return Buffer.from(pdf!);
  } finally {
    await browser.close();
  }
}
