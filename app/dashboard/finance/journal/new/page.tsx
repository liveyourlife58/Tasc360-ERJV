import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Breadcrumbs } from "@/components/dashboard/Breadcrumbs";
import { getAccountModuleSlug, getLedgerModuleSlug, getDefaultLedgerEntityId } from "@/lib/finance-settings";
import { createJournalEntry } from "@/app/dashboard/finance/actions";
import { JournalEntryForm } from "./JournalEntryForm";

export default async function NewJournalEntryPage() {
  const h = await headers();
  const tenantId = h.get("x-tenant-id");
  if (!tenantId) redirect("/login");

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true, slug: true },
  });
  if (!tenant) redirect("/login");

  const accountSlug = getAccountModuleSlug(tenant.settings as Record<string, unknown>);
  const ledgerSlug = getLedgerModuleSlug(tenant.settings as Record<string, unknown>);
  const defaultLedgerId = getDefaultLedgerEntityId(tenant.settings as Record<string, unknown>);

  const [accountModule, ledgerModule] = await Promise.all([
    prisma.module.findFirst({ where: { tenantId, slug: accountSlug, isActive: true }, select: { id: true } }),
    prisma.module.findFirst({ where: { tenantId, slug: ledgerSlug, isActive: true }, select: { id: true } }),
  ]);

  const [accountEntities, ledgerEntities] = await Promise.all([
    accountModule
      ? prisma.entity.findMany({
          where: { tenantId, moduleId: accountModule.id, deletedAt: null },
          select: { id: true, data: true },
          orderBy: { createdAt: "asc" },
        })
      : [],
    ledgerModule
      ? prisma.entity.findMany({
          where: { tenantId, moduleId: ledgerModule.id, deletedAt: null },
          select: { id: true, data: true },
          orderBy: { createdAt: "asc" },
        })
      : [],
  ]);

  const accountOptions = accountEntities.map((e) => {
    const d = (e.data as Record<string, unknown>) ?? {};
    const label = (d.name as string) ?? (d.title as string) ?? e.id.slice(0, 8);
    return { id: e.id, label: String(label) };
  });
  const ledgerOptions = ledgerEntities.map((e) => {
    const d = (e.data as Record<string, unknown>) ?? {};
    const label = (d.name as string) ?? (d.title as string) ?? e.id.slice(0, 8);
    return { id: e.id, label: String(label) };
  });

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Finance", href: "/dashboard/finance" },
          { label: "New journal entry" },
        ]}
      />
      <div className="page-header">
        <h1>New journal entry</h1>
        <Link href="/dashboard/finance" className="btn btn-secondary">
          Back to Finance
        </Link>
      </div>
      {accountOptions.length === 0 ? (
        <p className="view-error" role="alert">
          No account entities found. Create a module with slug &quot;account&quot; (or set Finance settings) and add account entities to post journal entries.
        </p>
      ) : (
        <JournalEntryForm
          createAction={createJournalEntry}
          accountOptions={accountOptions}
          ledgerOptions={ledgerOptions}
          defaultLedgerId={defaultLedgerId}
          tenantSlug={tenant.slug}
        />
      )}
    </div>
  );
}
