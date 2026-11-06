/** Shared bearer-key check for scheduler endpoints (INGEST_KEY). Returns a Response when access is refused. */
export async function refuseUnlessIngestKey(request: Request): Promise<Response | null> {
  const key = process.env["INGEST_KEY"];
  if (!key) return Response.json({ error: "INGEST_KEY is not set on the server." }, { status: 500 });
  const token = /^Bearer (\S+)$/.exec(request.headers.get("authorization") ?? "")?.[1] ?? "";
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const digest = (v: string) => createHash("sha256").update(v, "utf8").digest();
  if (!token || !timingSafeEqual(digest(token), digest(key))) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return null;
}
