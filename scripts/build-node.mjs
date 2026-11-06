#!/usr/bin/env node
// Builds Brief as a normal Node server (the default build targets Cloudflare).   Run:  npm run build:node
// Reads the site's VITE_ settings from .env while building (they are baked into the pages), so build with the .env in place.
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["vite", "build"], {
  stdio: "inherit",
  shell: process.platform === "win32", // npx is a .cmd file on Windows
  env: { ...process.env, NITRO_PRESET: "node-server" },
});
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("\nBuilt for Node: .output/server/index.mjs\nStart it with:  npm start");
