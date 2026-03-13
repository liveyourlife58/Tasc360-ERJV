# Tenant API

REST API for tenant data. Use it to build custom customer frontends, integrations, or scripts. All routes are under `/api/v1/tenants/:tenantIdOrSlug/` and require a tenant API key.

A minimal **OpenAPI 3.0** spec is in [openapi-tenant-api.yaml](openapi-tenant-api.yaml) for code generation or tools (e.g. Postman, Insomnia).

## API versioning

- The path prefix `/api/v1/` is stable. We will introduce `/api/v2/` only for **breaking** changes (e.g. response shape, required fields, or auth).
- Non-breaking additions (new optional query params, new response fields, new endpoints) may be added within v1 without notice. Prefer defensive clients that ignore unknown fields.

## Authentication

- **Header:** `X-API-Key: <your-api-key>`
- **Idempotency (optional):** For `POST` and `PATCH` on entities, send `Idempotency-Key: <unique-key>` (e.g. a UUID or client-generated string). The server caches the response for 24 hours; duplicate requests with the same key receive the cached response and do not create or update again. Use this to avoid duplicate entities or double updates on retries.
- **API key:** Create one or more keys in **Dashboard → Settings → API access**. Keys are hashed and can be revoked. You can also set a single legacy key in the same section (stored in `tenant.settings.apiKey`). Auth checks managed keys first, then the legacy key.
- **Tenant in path:** Use the tenant’s **UUID** or **slug** in the path (e.g. `/api/v1/tenants/acme/...` or `/api/v1/tenants/550e8400-e29b-41d4-a716-446655440000/...`). The server resolves slug to tenant and verifies the API key belongs to that tenant; if not, you get `401 Unauthorized` or `404 Tenant not found`.

Example:

```http
GET /api/v1/tenants/550e8400-e29b-41d4-a716-446655440000/modules
X-API-Key: your-secret-key
```

## Rate limiting

- Per-tenant (and per API key when provided). Default **100 requests per minute**; configurable via `API_RATE_LIMIT_PER_MINUTE`.
- On limit exceeded: `429 Too Many Requests` with `{ "error": "Too many requests." }`.
- Responses include **X-RateLimit-Limit**, **X-RateLimit-Remaining**, and **X-RateLimit-Reset** (Unix timestamp when the window ends) so clients can throttle.
- All `/api/v1/*` responses include **X-API-Version: 1** so clients can detect and lock to the API version.

## CORS

- All `/api/v1/*` responses include CORS headers. Default `Access-Control-Allow-Origin: *`; set `CORS_ORIGIN` in env to restrict to specific origins (e.g. your custom frontend’s domain).

## Soft delete

- **DELETE** on an entity sets `deletedAt`; the row is not removed. All list and get endpoints **exclude** soft-deleted entities by default (e.g. `GET .../entities` and `GET .../entities/:id` only return entities with `deletedAt` null). There is no API to list or restore deleted entities; use the dashboard for that.

## Request limits

- **Body size:** `POST` and `PATCH` requests to `/api/v1/*` are rejected with `413 Payload Too Large` if `Content-Length` exceeds **1MB**. Omit or reduce payload size and retry.
- **Timeout:** The server does not enforce a maximum request duration. Clients should set a request timeout (e.g. 30 seconds) to avoid hanging on slow or stuck requests.

---

## Endpoints

Base path: `/api/v1/tenants/:tenantId`. All responses are JSON. Errors return `{ "error": "<message>", "code"?: "<CODE>" }` with an appropriate HTTP status. Codes include: `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`, `VALIDATION_ERROR`, `INVALID_JSON`, `CONFLICT`, `INTERNAL`.

### List modules

```http
GET /api/v1/tenants/:tenantId/modules
```

**Response:** `{ "modules": [ { "id", "name", "slug", "description" }, ... ] }`

---

### List entities (by module)

```http
GET /api/v1/tenants/:tenantId/modules/:moduleSlug/entities?limit=50&cursor=<entityId>
```

- **Query:** `limit` (default 50, max 100), `cursor` or `after` (entity ID for next page).
- **Response:** `{ "entities": [ { "id", "data", "createdAt" }, ... ], "nextCursor"?: "<id>" }`. Omit `nextCursor` when there are no more pages.

---

### Create entity

```http
POST /api/v1/tenants/:tenantId/modules/:moduleSlug/entities
Content-Type: application/json

{ "<fieldSlug>": <value>, ... }
```

- **Body:** Object with keys = field slugs for that module; values = string, number, boolean, null, or array (for relation-multi). Only keys that match the module’s fields are applied. **Validation:** Required fields (per module field config) must be present; values are checked against field types (e.g. number field must receive a number).
- **Response:** `201` with `{ "id", "data", "createdAt" }`.
- **Errors:** `400` if body is not valid JSON, required fields are missing, or a value does not match the field type.

---

### Bulk update entities

```http
PATCH /api/v1/tenants/:tenantId/modules/:moduleSlug/entities
Content-Type: application/json

{ "ids": [ "<entityId>", ... ], "data": { "<fieldSlug>": <value>, ... } }
```

- **Body:** `ids` = array of entity IDs in this module; `data` = object of field slugs to values. Each matching entity gets its `data` merged with this patch.
- **Response:** `{ "updated": <number> }`.

---

### Get one entity

```http
GET /api/v1/tenants/:tenantId/modules/:moduleSlug/entities/:entityId
```

**Response:** `{ "id", "data", "createdAt", "updatedAt" }`. `404` if not found or wrong module.

**Caching:** The response includes an **ETag** header (weak, e.g. `W/"<id>-<updatedAtMs>"`). Send **If-None-Match** with that value; if the entity is unchanged, the API returns **304 Not Modified** with no body.

---

### Update one entity

```http
PATCH /api/v1/tenants/:tenantId/modules/:moduleSlug/entities/:entityId
Content-Type: application/json

{ "<fieldSlug>": <value>, ... }
```

- **Body:** Partial object; only provided field slugs are merged into the entity’s `data`.
- **Response:** `{ "id", "data", "updatedAt" }`.

---

### Delete one entity (soft delete)

```http
DELETE /api/v1/tenants/:tenantId/modules/:moduleSlug/entities/:entityId
```

- **Response:** `{ "deleted": true }`.
- **Error:** `400` with message if the entity has tickets sold (e.g. “Cannot delete: tickets have been sold. Refund or transfer first.”).

---

### Get related entities

```http
GET /api/v1/tenants/:tenantId/entities/:entityId/related?type=<relationType>&limit=50&after=<relationshipId>
```

- **Query:** `type` (optional) – filter by `relationType` (e.g. `donation`, `invoice`). `limit` (default 50, max 100). `after` – relationship ID for cursor pagination.
- **Response:** `{ "related": [ { "id", "relationshipId", "moduleSlug", "moduleName", "relationType", "direction": "out"|"in", "data" }, ... ], "nextCursor"?: "<relationshipId>" }`. Entities linked to this one via the relationships table (incoming and outgoing). Use `nextCursor` as `after` for the next page.

---

## Outbound webhooks

When you configure a webhook URL in **Dashboard → Settings → Webhooks**, the platform sends POST requests to your URL on entity and other events. Each request includes a stable **`deliveryId`** in the JSON payload and in the **`X-Webhook-Delivery-Id`** header so you can deduplicate or track deliveries (e.g. store `deliveryId` and skip processing if already seen).

---

## Not in this API

- **Cart, checkout, orders, tickets:** Handled by the built-in customer site (`/s/[tenantSlug]`). To support purchases from a custom frontend, either redirect users to this app for checkout or add dedicated APIs later.
- **Dashboard operations:** User login, permissions, views, settings, etc. are session-based in the dashboard, not exposed as API endpoints here.
- **Module/field management:** Creating or editing modules and fields is done in the dashboard only.

## Example: custom frontend

1. Get the tenant ID (from dashboard or your config) and the API key (Dashboard → Settings).
2. Call `GET .../modules` to list modules and pick a `slug`.
3. Call `GET .../modules/:moduleSlug/entities` (with optional `limit`/`cursor`) to list entities.
4. Call `GET .../modules/:moduleSlug/entities/:entityId` for one entity, or `GET .../entities/:entityId/related` for linked entities.
5. Use `POST` and `PATCH` to create/update entities as needed.

All requests must include the `X-API-Key` header and the correct `tenantId` in the path.
