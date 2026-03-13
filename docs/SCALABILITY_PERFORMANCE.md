# Scalability and performance

The Tasc360-ERJV schema and migration are designed to follow **best practices for multi-tenant PostgreSQL** so the same design scales with tenant count and data volume. This doc summarizes what’s in place, what the application must do, and optional steps when you outgrow single-node capacity.

---

## What’s already in place (best practices)

| Practice | How it’s implemented |
|----------|----------------------|
| **Tenant-first indexing** | Every tenant-scoped table has at least one index starting with `tenant_id`. Queries that filter by `tenant_id` (and often `tenant_id + module_id` or `tenant_id + entity_id`) use index range scans instead of full table scans. |
| **Composite indexes for common patterns** | Examples: `(tenant_id, module_id)`, `(tenant_id, module_id, created_at DESC)`, `(tenant_id, module_id, deleted_at)` on entities; `(tenant_id, entity_id)` on events, files, embeddings; `(tenant_id, entry_date)` on journal_entries; `(tenant_id, work_date)` on time_entries. List and filter-by-tenant workloads are covered. |
| **UUID primary keys** | No sequential leakage across tenants; safe for distributed or multi-region writes; no hot spots on a single sequence. |
| **Single entity table (no EAV)** | One row per entity; custom fields in JSONB. Avoids N+1 and huge joins that EAV causes. |
| **GIN on JSONB** | `entities.data` and `relationships.data` have GIN indexes for containment (`@>`, `?`, `?&`, `?|`). JSONB filters on indexed keys stay efficient. |
| **Full-text search** | Denormalized `entities.search_text` with GIN FTS index. FTS runs on a single column; no need to scan `data` for text search. |
| **Soft delete without full scan** | Index `(tenant_id, module_id, deleted_at)` supports “active” lists with `WHERE deleted_at IS NULL`. |
| **Vector search ready** | Optional pgvector with ivfflat index on `embeddings`; tenant-scoped indexes so vector search is always narrowed by tenant. |
| **Small, focused tables** | Ledger lines, payment allocations, time entries, etc. are normalized and indexed by tenant and foreign key. No unnecessary JSONB for high-volume, structured data. |

---

## Application responsibilities (required for good performance)

These are not enforced by the schema; the app must do them.

| Responsibility | Why it matters |
|----------------|----------------|
| **Always filter by tenant** | Every query must include `tenant_id` (from session, never from client). Otherwise indexes are not used effectively and RLS (if enabled) is bypassed. |
| **Paginate list queries** | Use `LIMIT` + `OFFSET` or cursor-based pagination (e.g. `WHERE (tenant_id, module_id, created_at, id) < ($tenant, $module, $cursor_at, $cursor_id)` using the existing composite index). Avoid loading unbounded entity lists. |
| **Prefer targeted selects** | When you only need ids or a few columns, avoid `SELECT *` on `entities` if you don’t need the full `data` payload. Reduces I/O and memory. |
| **Use connection pooling** | Use PgBouncer (or equivalent) or app-level pooling so connection count doesn’t scale linearly with app instances. |
| **Keep `search_text` in sync** | Maintain denormalized `search_text` on entity create/update so FTS and embedding pipelines stay fast and correct. |
| **Batch when possible** | For bulk creates (e.g. imports), use batch inserts and a single commit where appropriate to reduce round-trips and lock contention. |

---

## Query patterns that are well supported

- **List entities by module (active only):**  
  `WHERE tenant_id = $1 AND module_id = $2 AND deleted_at IS NULL` → uses `idx_entities_tenant_module_deleted` (or `idx_entities_tenant_module` + filter).
- **List entities by module, newest first:**  
  `ORDER BY created_at DESC` with `(tenant_id, module_id, created_at DESC)` index.
- **JSONB filter on entity data:**  
  `WHERE tenant_id = $1 AND module_id = $2 AND data @> '{"status":"active"}'` → tenant + module index narrows, then GIN on `data` for containment.
- **Full-text search:**  
  `WHERE tenant_id = $1 AND to_tsvector('english', search_text) @@ plainto_tsquery('english', $2)` → tenant index + GIN FTS.
- **Relationships from an entity:**  
  Indexes on `source_id` and `target_id` support “all links from/to this entity” without full scan.
- **Events / files / embeddings by entity:**  
  `(tenant_id, entity_id)` indexes support “everything for this entity” efficiently.

---

## Caveats and when to add more

| Area | Caveat | When to act |
|------|--------|-------------|
| **JSONB path filters** | `data->>'status' = 'active'` does not use GIN by itself; the planner can still use `(tenant_id, module_id)` to narrow, then filter. For very high volume, consider a partial index or a small “status” column if one field is filtered constantly. | Only if a single module has millions of rows and status filter is on every query. |
| **Events table growth** | Append-only events can grow very large. | When events exceed tens of millions of rows: partition by `tenant_id` or `created_at` (e.g. monthly), or archive old events to cold storage. |
| **Embeddings ivfflat** | `lists = 100` in the commented migration is a starting point. | When the embeddings table grows (e.g. > 100k rows per tenant), increase `lists` (e.g. sqrt(n) or more) and rebuild the index. |
| **Cross-tenant reporting** | No index supports “all tenants” aggregation. | By design; reporting should be per-tenant or run in a separate analytics store. |
| **Partitioning** | Tables are not partitioned today. | Consider partitioning `entities` or `events` by `tenant_id` or `created_at` when a single table reaches hundreds of millions of rows or one tenant dominates size. |

---

## Optional index tuning (only if needed)

- **Partial index for “active” entities:**  
  If most rows are soft-deleted and you want a smaller, faster index for “active only” lists:  
  `CREATE INDEX idx_entities_tenant_module_active ON entities (tenant_id, module_id, created_at DESC) WHERE deleted_at IS NULL;`  
  Use when the share of deleted rows is large and list queries always filter `deleted_at IS NULL`.

- **Covering index for list + sort:**  
  The existing `(tenant_id, module_id, created_at DESC)` already supports “list by module, newest first.” Add more columns to the index only if you have a proven need (e.g. include `id` for cursor pagination); otherwise keep indexes narrow to reduce size and lock cost.

---

## Summary

| Question | Answer |
|----------|--------|
| **Does the design follow best practices for scalability and performance?** | **Yes.** Tenant-first indexing, UUIDs, composite indexes for common patterns, GIN for JSONB and FTS, one entity table, and optional pgvector are aligned with multi-tenant PostgreSQL best practices. |
| **What’s required from the app?** | Always filter by tenant, paginate lists, use connection pooling, keep `search_text` in sync, and avoid unbounded or cross-tenant scans. |
| **When to go further?** | Partition or archive when a table (e.g. events, entities) or a single tenant grows very large; tune ivfflat `lists` when embeddings grow; add partial or covering indexes only when profiling shows a need. |

The schema is built so that **the critical path (tenant-scoped entity and relationship access)** stays index-driven and avoids N+1 and full scans. Heavy reporting or cross-tenant analytics are better handled by materialized views, read replicas, or a separate data warehouse fed from this database.
