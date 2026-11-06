import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { parseEdition } from "./editions";
import { loadNews } from "./news.server";

/** The live feed for one edition ("world" or a country code). */
export const getNews = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ edition: z.string().max(8).optional() }).parse(d ?? {}))
  .handler(async ({ data }) => {
    const edition = parseEdition(data.edition);
    const items = await loadNews(edition);
    return { items, fetchedAt: Date.now(), edition };
  });
