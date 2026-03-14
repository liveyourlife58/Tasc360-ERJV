# Roles and permissions

Dashboard access is controlled by **roles** and **permissions**. Each user has one role per tenant; the role holds a list of permissions (or `*` for full access). If a user has no role, they get full access for backward compatibility.

## Permission list

| Permission | What it gates |
|------------|----------------|
| **entities:read** | View entity list and detail pages; Activity log and Activity CSV export; Approvals page (view pending); Consent page (view); tenant data export (backup). |
| **entities:write** | Create, edit, delete, restore, clone entities; request approval; approve/reject approval requests; record/revoke consent. |
| **modules:manage** | Create, edit, reorder, delete modules; add/edit/remove/reorder fields; apply templates; AI module creation. |
| **views:manage** | Create, edit, delete views; set default view; filter/sort/columns on views. |
| **settings:manage** | Settings (branding, finance config, feature flags, consent types, customer site, etc.); Finance page and journal entries; Subscription & billing (Stripe checkout/portal). |
| **settings:developer** | API keys, Webhooks and Integrations (only visible when the tenant has "Developer setup" enabled). Create/revoke API keys; configure webhook URL; open Integrations page. |
| **users:manage** | Team page: add user, invite, edit user (role, name, email, password, active); create and edit roles and their permissions. |
| **\*** (full access) | All of the above. |

Permission checks are enforced in server actions and in route handlers (e.g. CSV export). Pages that require a specific permission redirect to `/dashboard` if the user lacks it (e.g. Activity and Approvals require `entities:read`; Finance and Integrations require `settings:manage`).

### Developer setup (per tenant)

By default, **API keys**, **Webhooks** and **Integrations** are hidden from the dashboard so non-technical tenants only see day-to-day settings. To give a particular tenant the ability to manage their own setup:

1. **Enable developer setup for the tenant**  
   Only users listed in `PLATFORM_ADMIN_EMAILS` (env) see a "Turn on developer setup" control in **Settings**. Turn it on for that tenant.

2. **Grant the permission**  
   Ensure at least one user (e.g. their admin) has the **settings:developer** permission (via the admin role or a custom role). That user will then see the API access and Webhooks sections in Settings, the Integrations link in the sidebar, and the Integrations page.

## Default roles

When a tenant is set up (e.g. on first load of Team or Subscription), the app ensures two default roles exist:

- **admin** — Permissions: `*` (full access). Use for owners and admins.
- **standard** — Permissions: `entities:read`, `entities:write`, `views:manage`. Can use modules and views; cannot manage settings, modules, users, or roles.

You can create custom roles from **Dashboard → Team → Roles** (if you have `users:manage`) and assign any combination of the permissions above.

## Where permissions are defined

- **Constants and labels:** `lib/permissions.ts` — `PERMISSIONS` and `PERMISSION_LABELS`. When adding a new permission, add it here and use it in actions/pages; the Team role editor will show it automatically.
- **Default roles:** `lib/roles.ts` — `ensureDefaultRoles()` creates admin and standard if missing.
- **Checks:** Server actions call `requireDashboardPermission(permission)` (in `app/dashboard/actions.ts`) or `hasPermission(userId, permission)` for conditional UI; route handlers use `hasPermission(session.userId, PERMISSIONS.…)` and return 403 if missing.

## Optional: restrict who can see the Team page

Currently any logged-in user can open **Team** and see the user list; only users with `users:manage` can add/edit users or manage roles. If you want only admins to see the Team page at all, add a permission check at the top of `app/dashboard/team/page.tsx` and redirect to `/dashboard` when the user lacks `users:manage`.
