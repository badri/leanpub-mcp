import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { LeanpubClient } from "./client.js";

const client = new LeanpubClient();

/** Wraps a tool handler so a thrown LeanpubApiError (or anything else)
 * becomes a tool-level error result instead of crashing the connection. */
function toResult(promise) {
  return promise.then(
    (data) => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] }),
    (err) => ({
      content: [{ type: "text", text: err instanceof Error ? err.message : String(err) }],
      isError: true,
    }),
  );
}

export function createServer() {
  const server = new McpServer({ name: "leanpub-mcp", version: "0.1.0" });

  server.registerTool(
    "verify_api_key",
    { description: "Verify the configured Leanpub API key and return the authenticated user." },
    () => toResult(client.verifyApiKey()),
  );

  server.registerTool(
    "get_book",
    {
      description: "Get a book's summary: title, word/page counts, sales, and preview/published download URLs.",
      inputSchema: { slug: z.string().describe("Book slug, e.g. 'kafka-taxi'") },
    },
    ({ slug }) => toResult(client.getBook(slug)),
  );

  server.registerTool(
    "check_book_exists",
    {
      description: "Check whether a book slug exists and you are an author of it.",
      inputSchema: { slug: z.string() },
    },
    ({ slug }) => toResult(client.checkBookExists(slug)),
  );

  server.registerTool(
    "create_book",
    {
      description: "Create a new Leanpub book (Browser, GitHub, or Upload mode).",
      inputSchema: {
        title: z.string(),
        slug: z.string(),
        syncMode: z.enum(["monaco", "github", "upload"]).optional(),
        languageId: z.string().optional(),
        publisherId: z.string().optional(),
        githubPath: z.string().optional().describe("Required for GitHub mode, e.g. 'user/repo'"),
        publishBranch: z.string().optional(),
        previewBranch: z.string().optional(),
      },
    },
    (args) => toResult(client.createBook(args)),
  );

  server.registerTool(
    "create_bundle",
    {
      description: "Create a new Leanpub bundle.",
      inputSchema: { title: z.string(), slug: z.string(), publisherId: z.string().optional() },
    },
    (args) => toResult(client.createBundle(args)),
  );

  server.registerTool(
    "create_course",
    {
      description: "Create a new Leanpub course.",
      inputSchema: {
        title: z.string(),
        slug: z.string(),
        languageId: z.string(),
        publisherId: z.string().optional(),
        syncMode: z.enum(["monaco", "github"]).optional(),
        githubPath: z.string().optional(),
        publishBranch: z.string().optional(),
        previewBranch: z.string().optional(),
      },
    },
    (args) => toResult(client.createCourse(args)),
  );

  server.registerTool(
    "create_track",
    {
      description: "Create a new Leanpub track (curated collection of courses).",
      inputSchema: { title: z.string(), slug: z.string(), publisherId: z.string().optional() },
    },
    (args) => toResult(client.createTrack(args)),
  );

  server.registerTool(
    "preview_book",
    {
      description: "Start a full preview generation (PDF + EPUB) for a book. Returns immediately; poll get_job_status or use wait_for_job to know when it's done.",
      inputSchema: { slug: z.string() },
    },
    ({ slug }) => toResult(client.previewBook(slug)),
  );

  server.registerTool(
    "preview_subset",
    {
      description: "Generate a faster PDF-only preview using Subset.txt.",
      inputSchema: { slug: z.string() },
    },
    ({ slug }) => toResult(client.previewSubset(slug)),
  );

  server.registerTool(
    "preview_single",
    {
      description: "Preview a single chapter from raw Markdown content without touching Subset.txt. Saved as {slug}-single-file.pdf.",
      inputSchema: { slug: z.string(), markdown: z.string() },
    },
    ({ slug, markdown }) => toResult(client.previewSingle(slug, markdown)),
  );

  server.registerTool(
    "publish_book",
    {
      description: "Publish a book, making the latest version available to readers.",
      inputSchema: {
        slug: z.string(),
        emailReaders: z.boolean().optional().describe("Notify readers by email (default false)"),
        releaseNotes: z.string().optional(),
      },
    },
    ({ slug, ...rest }) => toResult(client.publishBook(slug, rest)),
  );

  server.registerTool(
    "unpublish_book",
    {
      description: "Unpublish a book (primary author only).",
      inputSchema: { slug: z.string() },
    },
    ({ slug }) => toResult(client.unpublishBook(slug)),
  );

  server.registerTool(
    "retire_book",
    {
      description: "Retire a published book — no new purchases, existing readers keep access (primary author only).",
      inputSchema: { slug: z.string() },
    },
    ({ slug }) => toResult(client.retireBook(slug)),
  );

  server.registerTool(
    "close_book",
    {
      description: "Close a book completely — hidden from the store (primary author only).",
      inputSchema: { slug: z.string() },
    },
    ({ slug }) => toResult(client.closeBook(slug)),
  );

  server.registerTool(
    "get_job_status",
    {
      description: "Check the status of a running preview/publish job. Returns {} when no job is running.",
      inputSchema: { slug: z.string() },
    },
    ({ slug }) => toResult(client.getJobStatus(slug)),
  );

  server.registerTool(
    "wait_for_job",
    {
      description: "Poll get_job_status every 5s (configurable) until the job completes or the timeout elapses. Use right after preview_book/publish_book.",
      inputSchema: {
        slug: z.string(),
        timeoutSeconds: z.number().int().positive().optional().describe("Default 120"),
        intervalSeconds: z.number().int().positive().optional().describe("Default 5, minimum 5 per Leanpub's rate limit guidance"),
      },
    },
    ({ slug, timeoutSeconds, intervalSeconds }) =>
      toResult(
        client.waitForJob(slug, {
          timeoutMs: timeoutSeconds ? timeoutSeconds * 1000 : undefined,
          intervalMs: intervalSeconds ? intervalSeconds * 1000 : undefined,
        }),
      ),
  );

  server.registerTool(
    "get_royalties",
    {
      description: "Get a book's sales and royalties summary.",
      inputSchema: { slug: z.string() },
    },
    ({ slug }) => toResult(client.getRoyalties(slug)),
  );

  server.registerTool(
    "get_individual_purchases",
    {
      description: "Get a paginated list of individual purchases for a book.",
      inputSchema: { slug: z.string(), page: z.number().int().positive().optional(), email: z.string().optional() },
    },
    ({ slug, page, email }) => toResult(client.getIndividualPurchases(slug, { page, email })),
  );

  server.registerTool(
    "list_coupons",
    {
      description: "List all coupons for a book.",
      inputSchema: { slug: z.string() },
    },
    ({ slug }) => toResult(client.listCoupons(slug)),
  );

  server.registerTool(
    "get_coupon",
    {
      description: "Get details for a specific coupon.",
      inputSchema: { slug: z.string(), couponCode: z.string() },
    },
    ({ slug, couponCode }) => toResult(client.getCoupon(slug, couponCode)),
  );

  server.registerTool(
    "create_coupon",
    {
      description: "Create a new coupon for a book.",
      inputSchema: {
        slug: z.string(),
        couponCode: z.string(),
        discountedPrice: z.number().positive(),
        packageSlug: z.string().optional().describe("Default 'book'"),
        startDate: z.string().describe("YYYY-MM-DD"),
        endDate: z.string().optional().describe("YYYY-MM-DD"),
        maxUses: z.number().int().positive().optional(),
        note: z.string().optional(),
      },
    },
    ({ slug, couponCode, discountedPrice, packageSlug, startDate, endDate, maxUses, note }) =>
      toResult(
        client.createCoupon(slug, {
          coupon_code: couponCode,
          package_discounts_attributes: [
            { package_slug: packageSlug ?? "book", discounted_price: discountedPrice },
          ],
          start_date: startDate,
          end_date: endDate,
          max_uses: maxUses,
          note,
        }),
      ),
  );

  server.registerTool(
    "update_coupon",
    {
      description: "Update an existing coupon (suspend/resume, change uses, etc). Only include fields to change.",
      inputSchema: {
        slug: z.string(),
        couponCode: z.string(),
        suspended: z.boolean().optional(),
        maxUses: z.number().int().positive().optional(),
        note: z.string().optional(),
        endDate: z.string().optional(),
      },
    },
    ({ slug, couponCode, suspended, maxUses, note, endDate }) =>
      toResult(
        client.updateCoupon(slug, couponCode, {
          suspended,
          max_uses: maxUses,
          note,
          end_date: endDate,
        }),
      ),
  );

  server.registerTool(
    "get_user_reader_emails",
    {
      description: "Get emails of readers who opted to share them with you, across all your books/courses.",
      inputSchema: { username: z.string(), type: z.enum(["all", "book", "course"]).optional() },
    },
    ({ username, type }) => toResult(client.getUserReaderEmails(username, type)),
  );

  server.registerTool(
    "get_book_reader_emails",
    {
      description: "Get emails of readers of a specific book who opted to share them.",
      inputSchema: { slug: z.string() },
    },
    ({ slug }) => toResult(client.getBookReaderEmails(slug)),
  );

  server.registerTool(
    "register_interest",
    {
      description: "Register a reader's interest in an unpublished book so they're notified on publish.",
      inputSchema: {
        slug: z.string(),
        name: z.string(),
        email: z.string().email(),
        shareEmailWithAuthor: z.boolean().optional(),
      },
    },
    ({ slug, ...rest }) => toResult(client.registerInterest(slug, rest)),
  );

  server.registerTool(
    "get_interested_readers",
    {
      description: "List readers who registered interest and opted to share their email.",
      inputSchema: { slug: z.string() },
    },
    ({ slug }) => toResult(client.getInterestedReaders(slug)),
  );

  server.registerTool(
    "preview_course",
    {
      description: "Start a preview generation for a course (self-published, organization, or university).",
      inputSchema: {
        slug: z.string(),
        organizationSlug: z.string().optional(),
        universitySlug: z.string().optional(),
      },
    },
    (course) => toResult(client.previewCourse(course)),
  );

  server.registerTool(
    "publish_course",
    {
      description: "Publish a course (self-published, organization, or university).",
      inputSchema: {
        slug: z.string(),
        organizationSlug: z.string().optional(),
        universitySlug: z.string().optional(),
        emailReaders: z.boolean().optional(),
        releaseNotes: z.string().optional(),
        percentComplete: z.number().int().min(0).max(100).optional(),
      },
    },
    ({ slug, organizationSlug, universitySlug, ...rest }) =>
      toResult(client.publishCourse({ slug, organizationSlug, universitySlug }, rest)),
  );

  return server;
}
