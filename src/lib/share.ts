import { recordEvent } from "./tracker";

export const waLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;

const SITE_SIGNATURE = "Brief — the world in a nutshell";

function tag(value: string) {
  const cleaned = value.replace(/[^A-Za-z0-9]/g, "");
  return cleaned ? `#${cleaned}` : "";
}

export function shareTags(category?: string) {
  return ["#Brief", "#News", category ? tag(category) : ""].filter(Boolean).join(" ");
}

export function signedShareText(content: string, link?: string, category?: string) {
  return [content.trim(), link, `— ${SITE_SIGNATURE}`, shareTags(category)].filter(Boolean).join("\n");
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > max && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

/** Draws a 1080x1920 (WhatsApp status) quote card and shares or downloads it. */
export async function shareQuoteCard(quote: string, source: string, category: string) {
  recordEvent("quote_card", category);
  const W = 1080, H = 1920;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#111111"; ctx.fillRect(0, 0, W, H);
  ["#111111", "#c8102e", "#0a7a3b"].forEach((col, n) => { ctx.fillStyle = col === "#111111" ? "#f5f1e8" : col; ctx.fillRect((W / 3) * n, 0, W / 3, 24); });
  ctx.fillStyle = "#c8102e"; ctx.font = "bold 40px sans-serif"; ctx.fillText(category.toUpperCase(), 90, 300);
  ctx.fillStyle = "#f5f1e8"; ctx.font = "bold 180px serif"; ctx.fillText("“", 70, 500);
  ctx.font = "bold 68px serif";
  const lines = wrap(ctx, quote, W - 180).slice(0, 14);
  lines.forEach((l, n) => ctx.fillText(l, 90, 600 + n * 90));
  ctx.fillStyle = "#a8a29e"; ctx.font = "36px sans-serif";
  ctx.fillText(`— ${source}`, 90, 600 + lines.length * 90 + 60);
  ctx.fillStyle = "#f5f1e8"; ctx.font = "bold 64px serif"; ctx.fillText("Brief", 90, H - 180);
  ctx.fillStyle = "#a8a29e"; ctx.font = "32px sans-serif";
  ctx.fillText("The world in a nutshell", 90, H - 130);
  ctx.fillText(shareTags(category), 90, H - 80);
  const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, "image/png"));
  if (!blob) return;
  const file = new File([blob], "kenya-pulse.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text: quote }); return; } catch { /* cancelled */ return; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = "kenya-pulse.png"; a.click();
}
