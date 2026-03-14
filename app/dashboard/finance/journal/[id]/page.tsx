import { headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getTenantLocale } from "@/lib/format";
import { Breadcrumbs } from "@/components/dashboard/Breadcrumbs";

function formatAmountCents(cents: number, currency: string, locale?: string): string {
  return new Intl.NumberFormat(locale || undefined, {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export default async function JournalEntryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  const userId = h.get("x-user-id");
  if (!tenantId || !userId) redirect("/login");

  const canManage = await hasPermission(userId, PERMISSIONS.settingsManage);
  if (!canManage) redirect("/dashboard");

  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const locale = getTenantLocale(tenant?.settings ?? null);

  const je = await prisma.journalEntry.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      entryDate: true,
      reference: true,
      description: true,
      status: true,
      externalId: true,
      ledgerEntityId: true,
      createdAt: true,
      lines: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          accountEntityId: true,
          debitCents: true,
          creditCents: true,
          currency: true,
          description: true,
          accountEntity: {
            select: { id: true, data: true },
          },
        },
      },
    },
  });

  if (!je) notFound();

  const accountLabel = (data: unknown): string => {
    if (!data || typeof data !== "object") return "";
    const d = data as Record<string, unknown>;
    return String(d.name ?? d.title ?? d.code ?? "—");
  };

  const totalDebit = je.lines.reduce((s, l) => s + l.debitCents, 0);
  const totalCredit = je.lines.reduce((s, l) => s + l.creditCents, 0);

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Finance", href: "/dashboard/finance" },
          { label: "Journal entry", href: `/dashboard/finance/journal/${je.id}` },
        ]}
      />
      <div className="page-header">
        <h1>Journal entry</h1>
        <Link href="/dashboard/finance" className="btn btn-secondary">
          Back to Finance
        </Link>
      </div>

      <div className="journal-entry-detail card" style={{ marginBottom: "1.5rem" }}>
        <dl className="journal-entry-meta">
          <dt>Date</dt>
          <dd>{new Date(je.entryDate).toLocaleDateString(locale || undefined)}</dd>
          <dt>Reference</dt>
          <dd>{je.reference ?? "—"}</dd>
          <dt>Description</dt>
          <dd>{je.description ?? "—"}</dd>
          <dt>Status</dt>
          <dd>{je.status}</dd>
          {je.externalId && (
            <>
              <dt>Synced to</dt>
              <dd>
                <span className="journal-entry-external-badge">External (e.g. QuickBooks)</span>
                <span className="journal-entry-external-id" title={je.externalId}>{je.externalId.slice(0, 12)}…</span>
              </dd>
            </>
          )}
        </dl>
      </div>

      <section className="subscription-section">
        <h2 className="subscription-heading">Lines</h2>
        <table className="subscription-team-table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Debit</th>
              <th>Credit</th>
              <th>Currency</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {je.lines.map((line) => (
              <tr key={line.id}>
                <td>{accountLabel(line.accountEntity?.data)}</td>
                <td style={{ textAlign: "right" }}>
                  {line.debitCents > 0 ? formatAmountCents(line.debitCents, line.currency, locale) : "—"}
                </td>
                <td style={{ textAlign: "right" }}>
                  {line.creditCents > 0 ? formatAmountCents(line.creditCents, line.currency, locale) : "—"}
                </td>
                <td>{line.currency}</td>
                <td>{line.description ?? "—"}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 600 }}>
              <td>Total</td>
              <td style={{ textAlign: "right" }}>{formatAmountCents(totalDebit, je.lines[0]?.currency ?? "USD", locale)}</td>
              <td style={{ textAlign: "right" }}>{formatAmountCents(totalCredit, je.lines[0]?.currency ?? "USD", locale)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </section>
    </div>
  );
}
