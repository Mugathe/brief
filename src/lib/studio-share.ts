export type ShareLinks = { whatsapp: string; facebook: string; x: string };

/** Share addresses for the apps that take a link, for browsers with no built-in share sheet (mostly desktop). */
export function shareLinks(text: string, url: string): ShareLinks {
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(text)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,
  };
}

/** The words that travel with a share: the story's caption, always with the link to it in Read the Brief. */
export function shareText(caption: string, title: string, url: string) {
  const base = (caption || title).trim();
  return base.includes(url) ? base : `${base}\n\n${url}`;
}

export type ShareOutcome = "shared" | "cancelled" | "needs-sheet";

/**
 * Shares one status. On phones this opens the share sheet with the picture or reel itself attached, so it lands in WhatsApp or
 * Facebook as a real file. Where files cannot be shared it shares the link; where nothing can be shared it says so, and the caller
 * shows its own links.
 */
export async function shareStatus(o: { title: string; text: string; url: string; media: { url: string; kind: "image" | "video" } }): Promise<ShareOutcome> {
  if (typeof navigator === "undefined" || !navigator.share) return "needs-sheet";
  try {
    const blob = await (await fetch(o.media.url)).blob();
    const file = new File([blob], o.media.kind === "video" ? "brief-reel.mp4" : "brief-picture.png", { type: blob.type || (o.media.kind === "video" ? "video/mp4" : "image/png") });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: o.text }); return "shared"; }
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    // the file could not be fetched or attached: fall through to sharing the link
  }
  try { await navigator.share({ title: o.title, text: o.text, url: o.url }); return "shared"; }
  catch (e) { return e instanceof DOMException && e.name === "AbortError" ? "cancelled" : "needs-sheet"; }
}
