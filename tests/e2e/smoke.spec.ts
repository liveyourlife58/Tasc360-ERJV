import { test, expect } from "@playwright/test";

test.describe("Smoke", () => {
  test("GET /api/health returns 200 and status ok", async ({ request }) => {
    const res = await request.get("/api/health");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  test("GET /api/ready returns 200 or 503", async ({ request }) => {
    const res = await request.get("/api/ready");
    expect([200, 503]).toContain(res.status());
    const body = await res.json();
    if (res.status() === 200) {
      expect(body.status).toBe("ready");
    } else {
      expect(body.status).toBe("not_ready");
    }
  });

  test("GET /api/v1/tenants/:slug/modules with API key (optional)", async ({ request }) => {
    const slug = process.env.E2E_TENANT_SLUG ?? "demo";
    const apiKey = process.env.E2E_API_KEY;
    if (!apiKey) {
      test.skip();
      return;
    }
    const res = await request.get(`/api/v1/tenants/${slug}/modules`, {
      headers: { "X-API-Key": apiKey },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("modules");
    expect(Array.isArray(body.modules)).toBe(true);
  });

  test("Tenant isolation: API key for tenant A cannot access tenant B (optional)", async ({ request }) => {
    const keyA = process.env.E2E_TENANT_ISOLATION_A_KEY;
    const slugB = process.env.E2E_TENANT_ISOLATION_B_SLUG;
    if (!keyA || !slugB) {
      test.skip();
      return;
    }
    const res = await request.get(`/api/v1/tenants/${slugB}/modules`, {
      headers: { "X-API-Key": keyA },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.code).toBe("UNAUTHORIZED");
  });
});
