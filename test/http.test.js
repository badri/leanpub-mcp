import { test } from "node:test";
import assert from "node:assert/strict";
import { buildUrl, parseResponse, LeanpubApiError } from "../src/http.js";

test("buildUrl joins the path onto leanpub.com and sets query params", () => {
  const url = buildUrl("/kafka-taxi.json", { api_key: "abc", page: 2 });
  assert.equal(url.origin, "https://leanpub.com");
  assert.equal(url.pathname, "/kafka-taxi.json");
  assert.equal(url.searchParams.get("api_key"), "abc");
  assert.equal(url.searchParams.get("page"), "2");
});

test("buildUrl omits null/undefined query values instead of stringifying them", () => {
  const url = buildUrl("/x.json", { email: undefined, page: null, keep: "yes" });
  assert.equal(url.searchParams.has("email"), false);
  assert.equal(url.searchParams.has("page"), false);
  assert.equal(url.searchParams.get("keep"), "yes");
});

test("parseResponse returns the parsed JSON body on a 200", async () => {
  const res = new Response(JSON.stringify({ ok: true }), { status: 200 });
  const body = await parseResponse(res);
  assert.deepEqual(body, { ok: true });
});

test("parseResponse throws LeanpubApiError with the status and API error text on failure", async () => {
  const res = new Response(JSON.stringify({ success: false, error: "Invalid API key." }), {
    status: 401,
  });
  await assert.rejects(
    () => parseResponse(res),
    (err) => {
      assert.ok(err instanceof LeanpubApiError);
      assert.equal(err.status, 401);
      assert.match(err.message, /Invalid API key\./);
      return true;
    },
  );
});

test("parseResponse joins multiple validation errors", async () => {
  const res = new Response(JSON.stringify({ success: false, errors: ["Title is required", "Slug is required"] }), {
    status: 422,
  });
  await assert.rejects(() => parseResponse(res), /Title is required; Slug is required/);
});

test("parseResponse handles a null body on a GET error (documented legacy behavior)", async () => {
  const res = new Response("null", { status: 404, statusText: "Not Found" });
  await assert.rejects(() => parseResponse(res), /404/);
});

test("parseResponse surfaces Retry-After on a 429", async () => {
  const res = new Response(JSON.stringify({ error: "Rate limited" }), {
    status: 429,
    headers: { "Retry-After": "45" },
  });
  await assert.rejects(() => parseResponse(res), /retry after 45s/);
});
