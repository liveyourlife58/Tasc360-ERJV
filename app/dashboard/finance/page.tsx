import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Breadcrumbs } from "@/components/dashboard/Breadcrumbs";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getAccountModuleSlug, getLedgerModuleSlug, getDefaultLedgerEntityId } from "@/lib/finance-settings";
import { getTenantLocale, formatDate } from "@/lib/format";
import { addExchangeRate, addFiscalPeriod, closeFiscalPeriod, updateFinanceSettings } from "./actions";
import { FinanceExchangeRatesForm } from "./FinanceExchangeRatesForm";
import { FinanceFiscalPeriodsForm } from "./FinanceFiscalPeriodsForm";
import { FinanceSettingsForm } from "./FinanceSettingsForm";
import { ClosePeriodButton } from "./ClosePeriodButton";

export default async function FinancePage() {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  const userId = h.get("x-user-id");
  if (!tenantId || !userId) redirect("/login");

  const canManage = await hasPermission(userId, PERMISSIONS.settingsManage);

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const settings = (tenant?.settings as Record<string, unknown>) ?? {};
  const accountSlug = getAccountModuleSlug(settings);
  const ledgerSlug = getLedgerModuleSlug(settings);
  const defaultLedgerId = getDefaultLedgerEntityId(settings);
  const locale = getTenantLocale(settings);

  const [exchangeRates, fiscalPeriods, journalEntries, ledgerModule, ledgerEntities] = await Promise.all([
    prisma.exchangeRate.findMany({
      where: { tenantId },
      orderBy: [{ effectiveDate: "desc" }, { fromCurrency: "asc" }, { toCurrency: "asc" }],
      select: { id: true, fromCurrency: true, toCurrency: true, rate: true, effectiveDate: true },
    }),
    prisma.fiscalPeriod.findMany({
      where: { tenantId },
      orderBy: { periodStart: "desc" },
      select: { id: true, periodStart: true, periodEnd: true, closedAt: true },
    }),
    prisma.journalEntry.findMany({
      where: { tenantId },
      orderBy: { entryDate: "desc" },
      take: 50,
      select: {
        id: true,
        entryDate: true,
        reference: true,
        description: true,
        status: true,
        _count: { select: { lines: true } },
      },
    }),
    prisma.module.findFirst({
      where: { tenantId, slug: ledgerSlug, isActive: true },
      select: { id: true, slug: true, name: true },
    }),
    ledgerSlug
      ? prisma.entity.findMany({
          where: {
            tenantId,
            module: { slug: ledgerSlug, isActive: true },
            deletedAt: null,
          },
          select: { id: true, data: true },
          orderBy: { createdAt: "asc" },
        })
      : [],
  ]);

  const ledgerOptions = ledgerEntities.map((e) => {
    const d = (e.data as Record<string, unknown>) ?? {};
    const label = (d.name as string) ?? (d.title as string) ?? e.id.slice(0, 8);
    return { id: e.id, label: String(label) };
  });

  return (
    <div>
      <Breadcrumbs items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Finance" }]} />
      <div className="page-header">
        <h1>Finance</h1>
        <Link href="/dashboard" className="btn btn-secondary">
          Back to Home
        </Link>
      </div>

      <p className="settings-hint" style={{ marginBottom: "1.5rem" }}>
        Exchange rates for multi-currency reporting and fiscal periods for period close. Journal entries can be scoped by ledger (entity from a Ledger module).
      </p>

      {canManage && (
        <section className="subscription-section" style={{ marginBottom: "2rem" }}>
          <h2 className="subscription-heading">Finance settings</h2>
          <p className="settings-hint" style={{ marginBottom: "0.75rem" }}>
            Module slugs for accounts and ledgers (e.g. &quot;account&quot;, &quot;ledger&quot;). Default ledger pre-fills when creating journal entries.
          </p>
          <FinanceSettingsForm
            updateAction={updateFinanceSettings}
            accountModuleSlug={accountSlug}
            ledgerModuleSlug={ledgerSlug}
            defaultLedgerEntityId={defaultLedgerId}
            ledgerOptions={ledgerOptions}
          />
        </section>
      )}

      {ledgerModule && (
        <section className="subscription-section" style={{ marginBottom: "2rem" }}>
          <h2 className="subscription-heading">Ledgers</h2>
          <p className="settings-hint" style={{ marginBottom: "0.75rem" }}>
            Entities from the &quot;{ledgerModule.name}&quot; module. Use as scope for journal entries.
          </p>
          {ledgerEntities.length === 0 ? (
            <p style={{ color: "#64748b" }}>No ledger entities yet. Create entities in the {ledgerModule.name} module.</p>
          ) : (
            <table className="subscription-team-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Link</th>
                </tr>
              </thead>
              <tbody>
                {ledgerEntities.map((e) => {
                  const d = (e.data as Record<string, unknown>) ?? {};
                  const label = (d.name as string) ?? (d.title as string) ?? e.id.slice(0, 8);
                  return (
                    <tr key={e.id}>
                      <td>{String(label)}</td>
                      <td>
                        <Link href={`/dashboard/m/${ledgerModule.slug}/${e.id}`}>View</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      )}

      <section className="subscription-section" style={{ marginBottom: "2rem" }}>
        <h2 className="subscription-heading">Journal entries</h2>
        <p className="settings-hint" style={{ marginBottom: "0.75rem" }}>
          Double-entry entries: date, reference, optional ledger, and lines (account, debit/credit, currency). Debits must equal credits.
        </p>
        {canManage && (
          <p style={{ marginBottom: "0.75rem" }}>
            <Link href="/dashboard/finance/journal/new" className="btn btn-primary">New journal entry</Link>
          </p>
        )}
        <table className="subscription-team-table" style={{ marginBottom: "1rem" }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Reference</th>
              <th>Description</th>
              <th>Status</th>
              <th>Lines</th>
            </tr>
          </thead>
          <tbody>
            {journalEntries.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ color: "#64748b" }}>No journal entries yet.</td>
              </tr>
            ) : (
              journalEntries.map((je) => (
                <tr key={je.id}>
                  <td>
                    <Link href={`/dashboard/finance/journal/${je.id}`} className="dashboard-table-link">
                      {formatDate(je.entryDate, locale)}
                    </Link>
                  </td>
                  <td>{je.reference ?? "—"}</td>
                  <td style={{ maxWidth: "12rem", overflow: "hidden", textOverflow: "ellipsis" }}>{je.description ?? "—"}</td>
                  <td>{je.status}</td>
                  <td>{je._count.lines}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="subscription-section" style={{ marginBottom: "2rem" }}>
        <h2 className="subscription-heading">Exchange rates</h2>
        <p className="settings-hint" style={{ marginBottom: "0.75rem" }}>
          One rate per from/to/effective date. Use for converting amounts to a home currency.
        </p>
        <table className="subscription-team-table" style={{ marginBottom: "1rem" }}>
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th>Rate</th>
              <th>Effective date</th>
            </tr>
          </thead>
          <tbody>
            {exchangeRates.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ color: "#64748b" }}>No exchange rates yet.</td>
              </tr>
            ) : (
              exchangeRates.map((r) => (
                <tr key={r.id}>
                  <td>{r.fromCurrency}</td>
                  <td>{r.toCurrency}</td>
                  <td>{Number(r.rate)}</td>
                  <td>{formatDate(r.effectiveDate, locale)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {canManage && <FinanceExchangeRatesForm addAction={addExchangeRate} />}
      </section>

      <section className="subscription-section">
        <h2 className="subscription-heading">Fiscal periods</h2>
        <p className="settings-hint" style={{ marginBottom: "0.75rem" }}>
          Define periods for reporting and period close. Closing a period prevents new journal entries for that period.
        </p>
        <table className="subscription-team-table" style={{ marginBottom: "1rem" }}>
          <thead>
            <tr>
              <th>Start</th>
              <th>End</th>
              <th>Status</th>
              {canManage && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {fiscalPeriods.length === 0 ? (
              <tr>
                <td colSpan={canManage ? 4 : 3} style={{ color: "#64748b" }}>No fiscal periods yet.</td>
              </tr>
            ) : (
              fiscalPeriods.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.periodStart, locale)}</td>
                  <td>{formatDate(p.periodEnd, locale)}</td>
                  <td>{p.closedAt ? "Closed" : "Open"}</td>
                  {canManage && (
                    <td>
                      {!p.closedAt && <ClosePeriodButton periodId={p.id} closeAction={closeFiscalPeriod} />}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
        {canManage && <FinanceFiscalPeriodsForm addAction={addFiscalPeriod} />}
      </section>
    </div>
  );
}
