import { publicClient } from "./public-client.server";

/**
 * Client for anonymous writes (visit tracking, failed-login reports, submissions).
 * Uses the anonymous key plus row-level-security insert policies, so it works everywhere,
 * including a local machine that has no service-role key.
 */
export function anonWriteClient() {
  return publicClient();
}
