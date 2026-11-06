import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyEnvFile, parseEnv } from "../../scripts/env.mjs";

describe("reading the .env file", () => {
  it("handles quotes, comments, spaces, blank lines and a byte-order mark", () => {
    const env = parseEnv('\uFEFF# settings\nPORT=3000\n\nHOST = "127.0.0.1"\nBRAND=\'Brief\'\nNOTE=hello # a comment\nQUOTED="keep # this"\nEMPTY=\nbad line\n  SPACED  =  value  \n');
    expect(env).toEqual({ PORT: "3000", HOST: "127.0.0.1", BRAND: "Brief", NOTE: "hello", QUOTED: "keep # this", EMPTY: "", SPACED: "value" });
  });
  it("accepts Windows line endings", () => {
    expect(parseEnv("A=1\r\nB=2\r\n")).toEqual({ A: "1", B: "2" });
  });
  it("adds file values without replacing real environment variables", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-env-"));
    fs.writeFileSync(path.join(dir, ".env"), "PORT=4000\nINGEST_KEY=from-file\n");
    const target: Record<string, string | undefined> = { PORT: "3000" };
    const added = applyEnvFile(dir, target);
    expect(target).toEqual({ PORT: "3000", INGEST_KEY: "from-file" });
    expect(added).toEqual(["INGEST_KEY"]);
  });
  it("does nothing when there is no .env", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "brief-noenv-"));
    expect(applyEnvFile(dir, {})).toEqual([]);
  });
});
