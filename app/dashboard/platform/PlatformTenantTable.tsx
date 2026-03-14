import Link from "next/link";

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  allowDeveloperSetup: boolean;
};

export function PlatformTenantTable({
  tenants,
  updateAction,
}: {
  tenants: TenantRow[];
  updateAction: (prevOrFormData: unknown, formDataArg?: FormData) => Promise<{ error?: string }>;
}) {
  return (
    <div className="card" style={{ overflowX: "auto" }}>
      <table className="subscription-team-table" style={{ width: "100%", minWidth: 360 }}>
        <thead>
          <tr>
            <th>Tenant</th>
            <th>Slug</th>
            <th>Developer setup</th>
            <th aria-hidden>Action</th>
          </tr>
        </thead>
        <tbody>
          {tenants.length === 0 ? (
            <tr>
              <td colSpan={4}>No tenants.</td>
            </tr>
          ) : (
            tenants.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link href={`/dashboard/platform/tenant/${t.id}`} className="dashboard-table-link">
                    {t.name}
                  </Link>
                </td>
                <td>
                  <code>{t.slug}</code>
                </td>
                <td>{t.allowDeveloperSetup ? "On" : "Off"}</td>
                <td>
                  <form action={updateAction as unknown as (formData: FormData) => Promise<void>} style={{ display: "inline" }}>
                    <input type="hidden" name="targetTenantId" value={t.id} />
                    <input type="hidden" name="enabled" value={t.allowDeveloperSetup ? "false" : "true"} />
                    <button type="submit" className="btn btn-secondary" style={{ fontSize: "0.875rem" }}>
                      {t.allowDeveloperSetup ? "Turn off" : "Turn on"}
                    </button>
                  </form>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
