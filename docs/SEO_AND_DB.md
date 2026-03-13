# SEO and DB Design for Customer Sites

This document evaluates whether the current database design supports SEO for the customer-facing site (`/s/[slug]/...`) and what, if anything, should change.

---

## What SEO needs (summary)

| Need | Purpose |
|------|---------|
| **Unique &lt;title&gt; per page** | Tab title, search result title |
| **Meta description** | Search snippet; social/share text |
| **Canonical URL** | Avoid duplicate-content penalties |
| **Open Graph / Twitter** | og:title, og:description, og:image for sharing |
| **Structured data (JSON-LD)** | Rich results (events, products, org) |
| **Sitemap** | List of public URLs + optional lastmod for crawlers |
| **Clean, stable URLs** | Already have `/s/[slug]/[segment]/[id]` |
| **Content in HTML** | Headings, text; we render from DB |

---

## What the current schema already supports

- **Tenant.settings** (JSON)  
  - `site.name`, `site.tagline`, `site.logo`, `site.primaryColor`  
  - Can extend with **no schema change**: e.g. `site.metaTitle`, `site.metaDescription`, `site.ogImage`, `site.canonicalBaseUrl` (for canonical + sitemap base).

- **Tenant.settings.pages**  
  - `pages.home` (HTML), about/contact content  
  - Can add per-route meta in JSON: e.g. `pages.about.metaTitle`, `pages.about.metaDescription`, `pages.home.metaTitle`, etc.

- **Module**  
  - `name`, `slug`, `description`  
  - `description` is a natural meta description for the module list page (`/s/[slug]/[segment]`).  
  - Optional: `settings.metaTitle` / `settings.metaDescription` override (still JSON, no migration).

- **Entity**  
  - `data` (JSON): title/name and other fields → can derive `<title>` and meta from first field or a “summary” field.  
  - **Entity.metadata** (JSON): intended for system/audit; can be used for **SEO overrides** (e.g. `metaTitle`, `metaDescription`, `ogImage`) without new columns.  
  - `updatedAt` → usable as `lastmod` in sitemaps.

- **Public URL set**  
  - Tenant slug + public modules + entity IDs are known from existing data → **sitemap can be built from current schema** (no new tables).

So: **no new columns or tables are strictly required** for basic SEO. All of the above can be done with:

- More use of existing **tenant.settings** (site and pages meta),
- Optional **module.settings** overrides,
- **Entity.metadata** for per-entity meta overrides,
- **Application logic**: generate &lt;title&gt;, meta tags, canonical, JSON-LD, and sitemap from existing data.

---

## Gaps today (application, not schema)

1. **No per-page &lt;title&gt; or meta tags**  
   Customer site pages don’t set `metadata` / `generateMetadata` in Next.js, so all `/s/...` pages likely share the root app title/description.

2. **No canonical URL**  
   No `<link rel="canonical">`; important if the same site is served under multiple domains or paths.

3. **No sitemap**  
   No `/sitemap.xml` (or tenant-specific sitemap) for `/s/[slug]/...`.

4. **No structured data**  
   No JSON-LD (e.g. Event, Product, Organization) from entity/module data.

5. **No explicit SEO fields in settings UI**  
   Dashboard settings don’t yet expose meta title/description/og image; they could be stored in existing `tenant.settings` once the UI exists.

---

## Recommended approach

### 1. No mandatory DB migrations

- Use **tenant.settings** for site-level and page-level SEO (meta title, description, og image, canonical base URL).
- Use **module.description** (and optionally `module.settings`) for list-page meta.
- Use **entity.data** (and optionally **entity.metadata**) for detail-page meta and for generating JSON-LD.

### 2. Optional: document the “SEO shape” of settings

In code or docs, define a minimal shape so the app and UI stay consistent, e.g.:

- `tenant.settings.site.metaTitle`, `site.metaDescription`, `site.ogImage`, `site.canonicalBaseUrl`
- `tenant.settings.pages.home.metaTitle`, `pages.about.metaTitle`, etc. (optional)
- `entity.metadata.metaTitle`, `entity.metadata.metaDescription`, `entity.metadata.ogImage` (optional overrides)

### 3. Application work (no schema change)

- Add **generateMetadata** (or static metadata) for `/s/[slug]`, `/s/[slug]/[segment]`, `/s/[slug]/[segment]/[id]`, and about/contact, using the data above.
- Emit **canonical** and **og/twitter** meta from the same data.
- Add a **sitemap** (e.g. `app/s/[slug]/sitemap.xml/route.ts`) that lists public URLs and uses `entity.updatedAt` (and tenant/module data) for `lastmod` where relevant.
- Optionally add **JSON-LD** for entity detail pages (and for organization on the home page) from `entity.data` and tenant/module info.

### 4. When a dedicated table *might* be useful

- **Custom domains**: If you add tenant-level custom domains (e.g. `acme.com` → tenant), you’ll need a place to store the domain and possibly SSL state; that’s a separate feature (could be `tenant.settings.site.customDomain` or a small `tenant_domains` table).
- **Sitemap cache**: If generating the sitemap is heavy, you could cache it (e.g. in a table or in blob storage); not required for correctness, only performance.

---

## Summary

- **DB design:** No schema changes are required for SEO. Use **Tenant.settings**, **Module** (and its **description** / **settings**), and **Entity.data** / **Entity.metadata** plus **updatedAt**.
- **Optimization:** Add metadata (title, description, canonical, og/twitter), sitemap, and optional JSON-LD in the app using this existing data; optionally document the SEO shape of `settings` and `metadata` and expose it in the dashboard later.
