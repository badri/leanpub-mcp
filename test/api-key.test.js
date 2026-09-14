import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// resolveApiKey reads process.env and cwd-relative paths at call time, so
// each test gets its own scratch directory and restores env/cwd after.
async function withScratchDir(run) {
  const dir = mkdtempSync(join(tmpdir(), "leanpub-mcp-test-"));
  const originalCwd = process.cwd();
  const originalEnv = { ...process.env };
  process.chdir(dir);
  try {
    await run(dir);
  } finally {
    process.chdir(originalCwd);
    process.env = originalEnv;
    rmSync(dir, { recursive: true, force: true });
  }
}

test("resolveApiKey prefers LEANPUB_API_KEY env var over any file", async () => {
  await withScratchDir(async (dir) => {
    writeFileSync(join(dir, ".leanpub-api-key"), "from-file\n");
    process.env.LEANPUB_API_KEY = "from-env";
    delete process.env.LEANPUB_API_KEY_FILE;
    const { resolveApiKey } = await import(`../src/api-key.js?t=${Date.now()}-1`);
    assert.equal(resolveApiKey(), "from-env");
  });
});

test("resolveApiKey falls back to .leanpub-api-key in the cwd", async () => {
  await withScratchDir(async (dir) => {
    writeFileSync(join(dir, ".leanpub-api-key"), "  file-key  \n");
    delete process.env.LEANPUB_API_KEY;
    delete process.env.LEANPUB_API_KEY_FILE;
    const { resolveApiKey } = await import(`../src/api-key.js?t=${Date.now()}-2`);
    assert.equal(resolveApiKey(), "file-key");
  });
});

test("resolveApiKey follows LEANPUB_API_KEY_FILE when set", async () => {
  await withScratchDir(async (dir) => {
    const customPath = join(dir, "custom-key-location");
    writeFileSync(customPath, "custom-file-key");
    delete process.env.LEANPUB_API_KEY;
    process.env.LEANPUB_API_KEY_FILE = customPath;
    const { resolveApiKey } = await import(`../src/api-key.js?t=${Date.now()}-3`);
    assert.equal(resolveApiKey(), "custom-file-key");
  });
});

test("resolveApiKey throws a descriptive error when no key is configured anywhere", async () => {
  await withScratchDir(async () => {
    delete process.env.LEANPUB_API_KEY;
    delete process.env.LEANPUB_API_KEY_FILE;
    const { resolveApiKey } = await import(`../src/api-key.js?t=${Date.now()}-4`);
    assert.throws(() => resolveApiKey(), /No Leanpub API key found/);
  });
});
