import { createFileRoute } from "@tanstack/react-router";

/** Studio renderer, step 2: one finished picture or reel, sent as a form (fields plus a "file"). Protected by INGEST_KEY. */
async function handle(request: Request): Promise<Response> {
  const { refuseUnlessIngestKey } = await import("@/lib/ingest-auth.server");
  const refused = await refuseUnlessIngestKey(request);
  if (refused) return refused;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "No file" }, { status: 400 });
    const str = (k: string) => String(form.get(k) ?? "");
    const links = JSON.parse(str("links") || "[]") as unknown;
    const { storeMedia } = await import("@/lib/studio.server");
    const out = await storeMedia({ edition: str("edition"), key: str("key"), kind: str("kind"), title: str("title"), category: str("category"), caption: str("caption"), link: str("link"), links }, new Uint8Array(await file.arrayBuffer()), file.type);
    return Response.json({ ok: true, ...out });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message.slice(0, 300) : "Upload failed" }, { status: 400 });
  }
}

export const Route = createFileRoute("/api/public/studio-upload")({ server: { handlers: { POST: ({ request }) => handle(request) } } });
