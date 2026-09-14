import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * Resolves the Leanpub API key fresh on every call — never cached — so
 * writing a new key to disk takes effect on the very next tool call, no
 * server restart required.
 *
 * Priority:
 *   1. LEANPUB_API_KEY env var (literal key)
 *   2. LEANPUB_API_KEY_FILE env var (path to a file containing the key)
 *   3. ./.leanpub-api-key relative to the current working directory
 *   4. ~/.config/leanpub/api_key
 *
 * Throws a descriptive error (surfaced to the caller as a tool error, not a
 * crash) when no key is configured anywhere.
 */
export function resolveApiKey() {
  if (process.env.LEANPUB_API_KEY?.trim()) {
    return process.env.LEANPUB_API_KEY.trim();
  }

  const candidates = [];
  if (process.env.LEANPUB_API_KEY_FILE) {
    candidates.push(process.env.LEANPUB_API_KEY_FILE);
  }
  candidates.push(join(process.cwd(), ".leanpub-api-key"));
  candidates.push(join(homedir(), ".config", "leanpub", "api_key"));

  for (const path of candidates) {
    try {
      const contents = readFileSync(path, "utf8").trim();
      if (contents) return contents;
    } catch {
      // Not found or unreadable — try the next candidate.
    }
  }

  throw new Error(
    "No Leanpub API key found. Set LEANPUB_API_KEY, set LEANPUB_API_KEY_FILE " +
      "to a file containing the key, or write the key to " +
      "'.leanpub-api-key' in the current directory or " +
      "'~/.config/leanpub/api_key'. Get a Pro-plan key from " +
      "https://leanpub.com/account/api_key",
  );
}
