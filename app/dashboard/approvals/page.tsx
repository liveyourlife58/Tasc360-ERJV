import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getPendingApprovals } from "@/app/dashboard/actions";
import { ApproveRejectForm } from "@/components/dashboard/ApproveRejectForm";

export default async function ApprovalsPage() {
  const tenantId = (await headers()).get("x-tenant-id");
  if (!tenantId) redirect("/login");

  const { error, approvals } = await getPendingApprovals();
  const list = approvals ?? [];

  return (
    <div>
      <div className="page-header">
        <h1>Approvals</h1>
      </div>
      <p className="settings-intro" style={{ marginBottom: "1.5rem" }}>
        Pending approval requests. Approve or reject to complete the workflow.
      </p>
      {error && <p className="view-error" role="alert">{error}</p>}
      {list.length === 0 ? (
        <p style={{ color: "#64748b", fontSize: "0.9375rem" }}>No pending approvals.</p>
      ) : (
        <table className="entity-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Record</th>
              <th>Requested by</th>
              <th>Date</th>
              <th style={{ width: 180 }}></th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => {
              const moduleSlug = a.entity?.module?.slug ?? "";
              const moduleName = a.entity?.module?.name ?? "";
              const recordTitle = String((a.entity?.data as Record<string, unknown>)?.name ?? (a.entity?.data as Record<string, unknown>)?.title ?? a.entity?.id?.slice(0, 8) ?? "—");
              return (
                <tr key={a.id}>
                  <td>{a.approvalType}</td>
                  <td>
                    {moduleSlug && a.entity ? (
                      <Link href={`/dashboard/m/${moduleSlug}/${a.entity.id}`}>{moduleName}: {recordTitle}</Link>
                    ) : (
                      recordTitle
                    )}
                  </td>
                  <td>{a.requestedByUser?.name ?? a.requestedByUser?.email ?? "—"}</td>
                  <td>{a.createdAt.toLocaleDateString()}</td>
                  <td>
                    <ApproveRejectForm approvalId={a.id} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
