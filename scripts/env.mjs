// Reads .env from the folder you run the command in (same rules as the app). Real environment variables win.
import fs from "node:fs";
import path from "node:path";

/** Turns the text of a .env file into { NAME: value }. Accepts quotes, comments, blank lines and a leading byte-order mark. */
export function parseEnv(text) {
  const env = {};
  for (const line of String(text).replace(/^\uFEFF/, "").split(/\r?\n/)) {
    if (/^\s*#/.test(line)) continue;
    const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m) continue;
    let value = m[2];
    const quoted = /^(["'])(.*)\1$/.exec(value);
    value = quoted ? quoted[2] : value.replace(/\s+#.*$/, ""); // an unquoted value ends at " #comment"
    env[m[1]] = value;
  }
  return env;
}

function readEnvFile(dir = process.cwd()) {
  const file = path.join(dir, ".env");
  return fs.existsSync(file) ? parseEnv(fs.readFileSync(file, "utf8")) : {};
}

export function loadEnv() {
  const env = readEnvFile();
  return (k) => (process.env[k] ?? env[k] ?? "").trim();
}

/** Puts the .env values into process.env without replacing anything already set (real environment variables win). Returns the names added. */
export function applyEnvFile(dir = process.cwd(), target = process.env) {
  const added = [];
  for (const [k, v] of Object.entries(readEnvFile(dir))) if (target[k] === undefined) { target[k] = v; added.push(k); }
  return added;
}
