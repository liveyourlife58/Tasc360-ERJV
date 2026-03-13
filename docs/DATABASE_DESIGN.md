# Tasc360-ERJV — Database design

## Principles

1. **Multi-tenant first** — `tenant_id` on every table; all indexes start with `tenant_id` where applicable.
2. **Flexibility** — Modules + fields let tenants define their own “tables” and columns; entities store JSONB.
3. **Graph relationships** — Explicit `relationships` table for customer→job→invoice style links.
4. **Audit and activity** — `events` table for everything that happens; no separate “history” tables per entity type.
5. **Scalability** — Tenant-first indexing on all tables; UUID PKs; GIN on `entities.data` and `relationships.data`; FTS on `entities.search_text`; composite indexes for list/sort/filter; optional pgvector on `embeddings`. Partition by tenant or time if needed at very large scale. See [SCALABILITY_PERFORMANCE.md](SCALABILITY_PERFORMANCE.md).
6. **AI-ready** — `embeddings` with chunking, model name, source field; `entities.search_text` + FTS for hybrid search; `events` for RAG context.
7. **Security** — Password hashes only; tenant_id on all tenant data; account lockout fields; audit via events/created_by; optional RLS (see [SECURITY.md](SECURITY.md)).

## Mapping from swad-app-emp / swad-app-main / fabrication

These domains are supported **without** copying the existing table layout. Use entities + relationships + optional hybrid tables.

| Domain | In Tasc360-ERJV |
|--------|------------------|
| **Tenants** | `tenants` (UUID, slug, plan, settings). |
| **Users / roles** | `users`, `roles` (tenant-scoped; permissions in JSON). |
| **Companies / contacts** | Module e.g. `customers` or `companies`; entity `data`: name, phone, email, address, etc. Contacts can be same module or separate; link via relationship. |
| **CRM (leads, opportunities, activities)** | Modules: `lead`, `opportunity`; entities with status/stage in `data`. Activities: `events` with `event_type` (e.g. `call`, `email`, `meeting`) and `entity_id` pointing at lead/opportunity. |
| **Estimates** | Module `estimate`; entity `data`: status, total, bill_to, ship_to, documents, labor_hours, line items (or store line items as child entities linked by relationship). |
| **Jobs / orders** | Module `job` or `order`; `data`: title, status, scheduled_date, etc. Relationship: customer → estimate → job. |
| **Work orders per job** | Module `work_order`; entity `data`: title, status, due_date, etc. Relationship: job → work_order (e.g. `relation_type` `job_work_order`). One job can have many work orders. |
| **Employee hours** | `time_entries` table: `user_id` (platform user), `job_entity_id`, optional `work_order_entity_id`, `hours`, `work_date`. Sum by job, by user, or by date for reporting. |
| **Invoices / payments** | Modules `invoice`, `payment`; relationships job→invoice, invoice→payment. |
| **Products / item variants** | Module `product` or `item`; `data`: sku, name, attributes (JSON). Variants as same module with relationship product→variant or nested in `data`. |
| **Vendors** | Module `vendor`; entity `data`: name, email, phone, address. Relationship product→vendor. |
| **Inventory** | For simple stock: entity type e.g. `inventory_location` + `inventory_level` with quantity in `data`. For cost layers, allocations, movements (like swad-app-emp), consider **hybrid**: keep a small set of relational tables (e.g. `inventory_movements`, `inventory_lots`) and link to entities via `entity_id`. |
| **Purchase orders / receipts** | Module `purchase_order`; `data`: status, lines (array), etc. Relationships: vendor→purchase_order; optional relational table for receipt line details if needed. |
| **Fabrication / door config** | Entity (e.g. under estimate or job) with `data` holding frame_parts, door_parts, panel_grid, form_dimensions (same shape as swad fabrication JSON). Or dedicated module `fabrication_order` with fields defined per tenant. |
| **Documents** | `files` table: `entity_id` + file_url, name, mime_type. Attach to any entity (estimate, job, customer). |
| **Activity / history** | `events` only; event_type e.g. `entity_created`, `status_changed`, `note_added`; `entity_id` + `data` for context. |

## When to add relational tables (hybrid)

- **Strict accounting or inventory ledgers** (cost layers, lot tracking, allocations): keep normalized tables and link via `entity_id` to the logical entity (e.g. estimate, job).
- **Reporting** that is much simpler with fixed columns: add materialized views or reporting tables that sync from entities.
- **High-frequency updates** on a small set of columns: consider a few “core” columns on entity (e.g. `status`, `updated_at`) and the rest in `data`.

## Query examples (conceptual)

- **All “customers” for a tenant:**  
  `SELECT * FROM entities e JOIN modules m ON e.module_id = m.id WHERE e.tenant_id = $1 AND m.slug = 'customer';`
- **Jobs for a customer (entity):**  
  `SELECT e.* FROM relationships r JOIN entities e ON e.id = r.target_id WHERE r.source_id = $customerEntityId AND r.relation_type = 'customer_job';`
- **Recent activity for an entity:**  
  `SELECT * FROM events WHERE tenant_id = $1 AND entity_id = $2 ORDER BY created_at DESC LIMIT 50;`

Use Prisma for CRUD and simple filters; use raw SQL for JSONB path filters (`data->>'status' = 'active'`) and, when enabled, vector similarity on `embeddings`.

---

## Entity + relationship + JSONB + vector: using to full potential

Getting the most out of the stack without hurting performance:

### Entity + JSONB

| Practice | Why it matters |
|----------|----------------|
| **Keep `search_text` in sync** | FTS and (often) embedding content come from it. On every entity create/update, concatenate the searchable fields from `data` (e.g. title, description, notes) into `search_text`. Same pipeline can feed the default text for embeddings. |
| **Use `data` for all tenant-defined fields** | One document per entity; GIN on `data` supports `@>`, `?`, `?&`, `?|`. Avoid EAV: no new tables or joins when tenants add fields. |
| **Use `metadata` for system/extensions** | Store external IDs, internal tags, or pipeline state in `metadata`. If you often filter by metadata (e.g. `metadata @> '{"external_id":"qb_123"}'`), add a GIN index on `entities.metadata` (optional; see migration). |
| **Always filter by tenant first** | All entity queries should include `tenant_id` (and usually `module_id`) so indexes are used and RLS (if enabled) is correct. |

### Relationship (graph) layer

| Practice | Why it matters |
|----------|----------------|
| **Use `relationship.data` for edge attributes** | Store quantity, role, effective date, or notes on the link (e.g. `{"role":"primary", "quantity":2}`). Lets you query “all relationships where role = primary” without overloading `relation_type`. |
| **Index edge attributes when you filter on them** | A GIN index on `relationships.data` (in the init migration) makes containment queries on `data` efficient (e.g. `WHERE data @> '{"role":"primary"}'`). |
| **Embed relationship context for graph RAG** | For “find similar deal flows” or “similar customer → job → invoice” patterns, create embeddings whose **content** describes the relationship (e.g. “Customer Acme → Job 123 → Invoice 456”). Use optional `embeddings.relationship_id`; keep `entity_id` as the “context” entity (e.g. source). Same vector table; hybrid search can mix entity chunks and relationship chunks. |

### Vector (embeddings)

| Practice | Why it matters |
|----------|----------------|
| **Chunk by `source_field`** | Store which part of the entity (or relationship) each chunk came from so RAG can cite “description” or “notes”. |
| **Store `model_name`** | Enables bulk re-embed when you change the embedding model; query by `model_name` to replace only that version. |
| **Hybrid search: FTS + vector** | Combine keyword (FTS on `search_text`) and vector similarity in the app (e.g. Reciprocal Rank Fusion — RRF). Better recall than either alone. Always narrow by `tenant_id` (and often `module_id`) before FTS/vector. |
| **Relationship-level embeddings** | When `embeddings.relationship_id` is set, `content` describes the edge (e.g. “Customer X ordered Job Y on …”). Use for graph-style semantic search (“deals that look like this pipeline”). |

### Summary

- **Entity**: One JSONB document per record; GIN on `data`; denormalized `search_text` for FTS and default embedding input.
- **Relationship**: First-class edges with optional JSONB `data`; GIN on `relationships.data` for edge filters; optional embeddings per relationship for graph RAG.
- **Vector**: Entity chunks + optional relationship chunks in one table; hybrid with FTS via RRF; tenant-scoped and model-versioned.
