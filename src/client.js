import { resolveApiKey } from "./api-key.js";
import { buildUrl, parseResponse } from "./http.js";

/**
 * Thin wrapper over the Leanpub author API (https://leanpub.com/help/api).
 * Resolves the API key fresh on every request via resolveApiKey() — no
 * caching, so a key written to disk after the server started is picked up
 * immediately.
 */
export class LeanpubClient {
  async #get(path, query = {}) {
    const url = buildUrl(path, { ...query, api_key: resolveApiKey() });
    const res = await fetch(url, { method: "GET" });
    return parseResponse(res);
  }

  async #postJson(path, jsonBody = {}) {
    const url = buildUrl(path);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...jsonBody, api_key: resolveApiKey() }),
    });
    return parseResponse(res);
  }

  async #postForm(path, formBody = {}) {
    const url = buildUrl(path);
    const params = new URLSearchParams();
    params.set("api_key", resolveApiKey());
    for (const [key, value] of Object.entries(formBody)) {
      if (value === undefined || value === null) continue;
      params.set(key, String(value));
    }
    const res = await fetch(url, { method: "POST", body: params });
    return parseResponse(res);
  }

  async #putForm(path, formBody = {}) {
    const url = buildUrl(path);
    const params = new URLSearchParams();
    params.set("api_key", resolveApiKey());
    for (const [key, value] of Object.entries(formBody)) {
      if (value === undefined || value === null) continue;
      params.set(key, String(value));
    }
    const res = await fetch(url, { method: "PUT", body: params });
    return parseResponse(res);
  }

  async #postRaw(path, text) {
    const url = buildUrl(path, { api_key: resolveApiKey() });
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: text,
    });
    return parseResponse(res);
  }

  // ---- Account ----
  verifyApiKey() {
    return this.#get("/current_user.json");
  }

  // ---- Books ----
  getBook(slug) {
    return this.#get(`/${slug}.json`);
  }

  checkBookExists(slug) {
    return this.#get(`/${slug}/exists.json`);
  }

  createBook({ title, slug, syncMode, languageId, publisherId, githubPath, publishBranch, previewBranch }) {
    return this.#postJson("/books.json", {
      title,
      slug,
      sync_mode: syncMode,
      language_id: languageId,
      publisher_id: publisherId,
      github_path: githubPath,
      publish_branch: publishBranch,
      preview_branch: previewBranch,
    });
  }

  createBundle({ title, slug, publisherId }) {
    return this.#postJson("/bundles.json", { title, slug, publisher_id: publisherId });
  }

  createCourse({ title, slug, languageId, publisherId, syncMode, githubPath, publishBranch, previewBranch }) {
    return this.#postJson("/courses.json", {
      title,
      slug,
      language_id: languageId,
      publisher_id: publisherId,
      sync_mode: syncMode,
      github_path: githubPath,
      publish_branch: publishBranch,
      preview_branch: previewBranch,
    });
  }

  createTrack({ title, slug, publisherId }) {
    return this.#postJson("/tracks.json", { title, slug, publisher_id: publisherId });
  }

  // ---- Preview & publish ----
  previewBook(slug) {
    return this.#postForm(`/${slug}/preview.json`);
  }

  previewSubset(slug) {
    return this.#postForm(`/${slug}/preview/subset.json`);
  }

  previewSingle(slug, markdown) {
    return this.#postRaw(`/${slug}/preview/single.json`, markdown);
  }

  publishBook(slug, { emailReaders, releaseNotes } = {}) {
    return this.#postForm(`/${slug}/publish.json`, {
      "publish[email_readers]": emailReaders,
      "publish[release_notes]": releaseNotes,
    });
  }

  unpublishBook(slug) {
    return this.#postForm(`/${slug}/unpublish.json`);
  }

  retireBook(slug) {
    return this.#postForm(`/${slug}/retire.json`);
  }

  closeBook(slug) {
    return this.#postForm(`/${slug}/close.json`);
  }

  getJobStatus(slug) {
    return this.#get(`/${slug}/job_status.json`);
  }

  /**
   * Polls job_status every `intervalMs` until it returns {} (complete) or
   * `timeoutMs` elapses. Mirrors the "poll until complete" pattern from the
   * Leanpub API docs, capped so the tool call can't hang forever.
   */
  async waitForJob(slug, { timeoutMs = 120_000, intervalMs = 5000 } = {}) {
    const deadline = Date.now() + timeoutMs;
    let last = null;
    while (Date.now() < deadline) {
      const status = await this.getJobStatus(slug);
      if (!status || Object.keys(status).length === 0) {
        return { complete: true, lastStatus: last };
      }
      last = status;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    return { complete: false, lastStatus: last, timedOut: true };
  }

  // ---- Sales & royalties ----
  getRoyalties(slug) {
    return this.#get(`/${slug}/royalties.json`);
  }

  getIndividualPurchases(slug, { page, email } = {}) {
    return this.#get(`/${slug}/individual_purchases.json`, { page, email });
  }

  // ---- Coupons ----
  listCoupons(slug) {
    return this.#get(`/${slug}/coupons.json`);
  }

  getCoupon(slug, couponCode) {
    return this.#get(`/${slug}/coupons/${couponCode}.json`);
  }

  createCoupon(slug, coupon) {
    return this.#postJson(`/${slug}/coupons.json`, { coupon });
  }

  updateCoupon(slug, couponCode, fields) {
    return this.#putForm(`/${slug}/coupons/${couponCode}.json`, fields);
  }

  // ---- Readers ----
  getUserReaderEmails(username, type) {
    return this.#get(`/u/${username}/reader_emails.json`, { type });
  }

  getBookReaderEmails(slug) {
    return this.#get(`/${slug}/reader_emails.json`);
  }

  registerInterest(slug, { name, email, shareEmailWithAuthor }) {
    return this.#postJson(`/${slug}/interested.json`, {
      name,
      email,
      share_email_with_author: shareEmailWithAuthor,
    });
  }

  getInterestedReaders(slug) {
    return this.#get(`/${slug}/interested_readers.json`);
  }

  // ---- Courses ----
  #courseBasePath({ slug, organizationSlug, universitySlug }) {
    if (universitySlug) return `/c/${universitySlug}/${slug}`;
    if (organizationSlug) return `/c/${organizationSlug}/${slug}`;
    return `/c/${slug}`;
  }

  previewCourse(course) {
    return this.#postForm(`${this.#courseBasePath(course)}/preview.json`);
  }

  publishCourse(course, { emailReaders, releaseNotes, percentComplete } = {}) {
    return this.#postForm(`${this.#courseBasePath(course)}/publish.json`, {
      "publish[email_readers]": emailReaders,
      "publish[release_notes]": releaseNotes,
      "publish[percent_complete]": percentComplete,
    });
  }
}
