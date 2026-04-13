import Link from "next/link";

export type DashboardHomeOverviewProps = {
  canReadEntities: boolean;
  /** When true, Modules on Home stays visible even if tenant has dashboardFeatures.settings off. */
  isPlatformAdmin?: boolean;
  features: {
    approvals: boolean;
    activity: boolean;
    teamBilling: boolean;
    settings: boolean;
  };
  approvalPendingCount: number;
  activityLast7dCount: number;
  subscriptionCard: { title: string; body: string; href?: string } | null;
  orderedModules: { id: string; name: string; slug: string }[];
};

export function DashboardHomeOverview({
  canReadEntities,
  isPlatformAdmin = false,
  features,
  approvalPendingCount,
  activityLast7dCount,
  subscriptionCard,
  orderedModules,
}: DashboardHomeOverviewProps) {
  return (
    <div className="dashboard-home-overview">
      {!canReadEntities && (
        <p className="settings-hint" style={{ maxWidth: "40rem", marginBottom: "1.5rem" }}>
          You don&apos;t have permission to read workspace records. Use the sidebar for settings, team, or other areas you can access.
        </p>
      )}

      {canReadEntities && (features.approvals || features.activity || (features.teamBilling && subscriptionCard)) && (
        <section
          className="dashboard-overview-stats"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(11rem, 1fr))",
            gap: "0.75rem",
            marginBottom: "1.75rem",
          }}
          aria-label="Summary"
        >
          {features.approvals && (
            <Link
              href="/dashboard/approvals"
              className="dashboard-overview-stat-card"
              style={{
                display: "block",
                padding: "1rem 1.1rem",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                background: "#fff",
                textDecoration: "none",
                color: "inherit",
                boxShadow: "0 1px 2px rgb(0 0 0 / 0.04)",
              }}
            >
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Approvals
              </span>
              <span style={{ display: "block", fontSize: "1.75rem", fontWeight: 700, color: "#0f172a", marginTop: "0.25rem" }}>
                {approvalPendingCount}
              </span>
              <span style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.2rem", display: "block" }}>pending</span>
            </Link>
          )}
          {features.activity && (
            <Link
              href="/dashboard/activity"
              className="dashboard-overview-stat-card"
              style={{
                display: "block",
                padding: "1rem 1.1rem",
                borderRadius: "10px",
                border: "1px solid #e2e8f0",
                background: "#fff",
                textDecoration: "none",
                color: "inherit",
                boxShadow: "0 1px 2px rgb(0 0 0 / 0.04)",
              }}
            >
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Activity
              </span>
              <span style={{ display: "block", fontSize: "1.75rem", fontWeight: 700, color: "#0f172a", marginTop: "0.25rem" }}>
                {activityLast7dCount}
              </span>
              <span style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.2rem", display: "block" }}>events (7 days)</span>
            </Link>
          )}
          {features.teamBilling && subscriptionCard && (
            <div
              style={{
                padding: "1rem 1.1rem",
                borderRadius: "10px",
                border: "1px solid #fde68a",
                background: "#fffbeb",
              }}
            >
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {subscriptionCard.title}
              </span>
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.875rem", color: "#78350f", lineHeight: 1.45 }}>{subscriptionCard.body}</p>
              {subscriptionCard.href && (
                <Link href={subscriptionCard.href} className="btn btn-secondary" style={{ marginTop: "0.65rem", display: "inline-block" }}>
                  Manage billing
                </Link>
              )}
            </div>
          )}
        </section>
      )}

      {(features.settings || isPlatformAdmin) && (
        <section aria-labelledby="dash-modules-heading">
          <div className="page-header" style={{ marginBottom: "0.75rem" }}>
            <h1 id="dash-modules-heading" style={{ marginBottom: 0 }}>
              Modules
            </h1>
            <div className="page-header-actions">
              <Link href="/dashboard/settings" className="btn btn-secondary">
                Modules &amp; data
              </Link>
            </div>
          </div>
          <ul className="dashboard-module-tiles" role="list">
            {orderedModules.map((m) => (
              <li key={m.id} className="dashboard-module-tile">
                {canReadEntities ? (
                  <Link href={`/dashboard/m/${m.slug}`} className="dashboard-module-tile-link">
                    <span className="dashboard-module-tile-label">{m.name}</span>
                  </Link>
                ) : (
                  <span
                    className="dashboard-module-tile-link"
                    style={{ cursor: "default", opacity: 0.75 }}
                    aria-disabled
                  >
                    <span className="dashboard-module-tile-label">{m.name}</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
