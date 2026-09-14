const BASE_URL = "https://leanpub.com";

/** Builds a leanpub.com URL, appending query params (skipping null/undefined). */
export function buildUrl(path, query = {}) {
  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, String(value));
  }
  return url;
}

/**
 * Turns a fetch Response into a plain result object, or throws a
 * LeanpubApiError with the status code and whatever error detail the API
 * returned. Never swallows a failure into a falsy success value.
 */
export async function parseResponse(res) {
  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (res.ok) return body;

  const detail =
    (body && typeof body === "object" &&
      (body.error || (Array.isArray(body.errors) && body.errors.join("; ")))) ||
    (typeof body === "string" ? body : null) ||
    res.statusText;

  const retryAfter = res.headers.get("retry-after");
  const suffix = retryAfter ? ` (retry after ${retryAfter}s)` : "";
  throw new LeanpubApiError(
    `Leanpub API ${res.status}: ${detail}${suffix}`,
    res.status,
    body,
  );
}

export class LeanpubApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "LeanpubApiError";
    this.status = status;
    this.body = body;
  }
}
