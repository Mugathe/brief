const TTL = 10 * 60_000;
const memo = new Map<string, { at: number; value: unknown }>();

export async function cached<T>(key: string, make: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  const value = await make();
  if (memo.size > 300) memo.clear();
  memo.set(key, { at: Date.now(), value });
  return value;
}

/** Called after editors change trails or ignored words, so the public pages update straight away. */
export const clearTrendCache = () => memo.clear();
