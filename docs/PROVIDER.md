# Provider / platform admin guide

This document is for anyone operating the platform (you or a partner) who needs to configure tenant accounts without giving tenants access to technical settings.

## Enabling “Developer setup” for a tenant

By default, tenants do **not** see API keys, Webhooks or Integrations in the dashboard. To give a particular tenant the ability to manage their own setup:

1. **Set platform admin emails**  
   In your environment, set:
   ```bash
   PLATFORM_ADMIN_EMAILS=admin@yourcompany.com,partner@agency.com
   ```
   (Comma-separated list. Only these users can enable or disable developer setup for any tenant.)

2. **Turn on developer setup for the tenant**  
   - Log in to the app as one of the platform admin users.  
   - Open the **tenant’s workspace** (if you have access to multiple tenants, switch to the one you want to configure).  
   - Go to **Dashboard → Settings**.  
   - In the “Dashboard & backend” section you’ll see: **“Allow this workspace to manage API keys, webhooks and integrations.”**  
   - Click **Turn on developer setup**.

   Alternatively, use **Platform admin** (see below) to turn it on without opening that tenant’s Settings.

3. **Grant the permission to the right users**  
   Users who should see API keys, Webhooks and Integrations need the **Manage API keys, webhooks & integrations** permission (`settings:developer`).  
   - The default **admin** role already has full access (`*`), so if the tenant’s admin should manage these, no change is needed.  
   - For a custom role, go to **Dashboard → Team → Roles**, edit the role, and enable **Manage API keys, webhooks & integrations**.

After that, users with that permission will see the **Integrations** link in the sidebar and the **API access** and **Webhooks** sections in Settings.

## Platform admin page

If you are listed in `PLATFORM_ADMIN_EMAILS`, the dashboard sidebar shows **Platform admin**. There you can:

- See all tenants (name, slug).
- Turn **Allow developer setup** on or off for each tenant without opening that tenant’s Settings.

Use this when you manage many tenants and want to enable or disable developer setup in one place.

## Turning developer setup off

- **From the tenant’s Settings:** Log in as a platform admin, open that tenant, go to **Settings**, and click **Turn off developer setup**.  
- **From Platform admin:** Open **Platform admin**, find the tenant, and turn the toggle off.

Once off, API keys, Webhooks and Integrations are hidden again for that tenant (and the Integrations page redirects to the dashboard).

## Audit

When developer setup is turned on or off, an event is recorded in that tenant’s **Activity** log: **developer_setup_enabled** or **developer_setup_disabled**, with the platform admin who made the change. This helps with support and compliance.

## See also

- [PERMISSIONS.md](PERMISSIONS.md) — Full list of permissions and the “Developer setup (per tenant)” section.  
- [.env.example](../.env.example) — `PLATFORM_ADMIN_EMAILS` is documented there.
