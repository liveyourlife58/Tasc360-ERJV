"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

async function requireFinancePermission() {
  const tenantId = (await headers()).get("x-tenant-id");
  const userId = (await headers()).get("x-user-id");
  if (!tenantId || !userId) throw new Error("Unauthorized");
  const ok = await hasPermission(userId, PERMISSIONS.settingsManage);
  if (!ok) throw new Error("You don't have permission to manage finance settings.");
  return tenantId;
}

/** Check if entryDate falls within a closed fiscal period. */
async function isDateInClosedPeriod(tenantId: string, entryDate: Date): Promise<boolean> {
  const d = new Date(entryDate);
  d.setHours(0, 0, 0, 0);
  const closed = await prisma.fiscalPeriod.findFirst({
    where: {
      tenantId,
      closedAt: { not: null },
      periodStart: { lte: d },
      periodEnd: { gte: d },
    },
  });
  return !!closed;
}

export type JournalLineInput = {
  accountEntityId: string;
  debitCents: number;
  creditCents: number;
  currency: string;
  description?: string;
};

export async function createJournalEntry(
  _prev: unknown,
  formData: FormData
): Promise<{ error?: string }> {
  let tenantId: string;
  let userId: string;
  try {
    tenantId = await requireFinancePermission();
    userId = (await headers()).get("x-user-id")!;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }
  const entryDateStr = (formData.get("entryDate") as string)?.trim();
  const reference = (formData.get("reference") as string)?.trim() || null;
  const description = (formData.get("description") as string)?.trim() || null;
  const ledgerEntityId = (formData.get("ledgerEntityId") as string)?.trim() || null;
  if (!entryDateStr) return { error: "Entry date is required." };
  const entryDate = new Date(entryDateStr);
  if (Number.isNaN(entryDate.getTime())) return { error: "Invalid entry date." };

  const closed = await isDateInClosedPeriod(tenantId, entryDate);
  if (closed) return { error: "Entry date falls in a closed fiscal period." };

  const linesJson = formData.get("lines") as string;
  let lines: JournalLineInput[];
  try {
    lines = JSON.parse(linesJson || "[]") as JournalLineInput[];
  } catch {
    return { error: "Invalid line data." };
  }
  if (!Array.isArray(lines) || lines.length === 0) return { error: "At least one line is required." };

  const validLines: { accountEntityId: string; debitCents: number; creditCents: number; currency: string; description?: string }[] = [];
  let totalDebit = 0;
  let totalCredit = 0;
  for (const line of lines) {
    const accountId = line?.accountEntityId && typeof line.accountEntityId === "string" ? line.accountEntityId.trim() : "";
    const debit = Math.round(Number(line?.debitCents) || 0);
    const credit = Math.round(Number(line?.creditCents) || 0);
    const currency = (line?.currency && typeof line.currency === "string" ? line.currency : "USD").toUpperCase().slice(0, 3);
    if (!accountId || (debit <= 0 && credit <= 0)) continue;
    validLines.push({
      accountEntityId: accountId,
      debitCents: debit,
      creditCents: credit,
      currency,
      description: (line?.description as string)?.trim() || undefined,
    });
    totalDebit += debit;
    totalCredit += credit;
  }
  if (validLines.length === 0) return { error: "At least one line with an account and debit or credit is required." };
  if (totalDebit !== totalCredit) return { error: "Total debits must equal total credits." };

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  const accountIds = [...new Set(validLines.map((l) => l.accountEntityId))];
  const accountEntities = await prisma.entity.findMany({
    where: { id: { in: accountIds }, tenantId, deletedAt: null },
    select: { id: true },
  });
  const accountIdSet = new Set(accountEntities.map((e) => e.id));
  for (const line of validLines) {
    if (!accountIdSet.has(line.accountEntityId)) return { error: `Invalid account: ${line.accountEntityId}` };
  }
  if (ledgerEntityId) {
    const ledger = await prisma.entity.findFirst({
      where: { id: ledgerEntityId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!ledger) return { error: "Invalid ledger." };
  }

  await prisma.journalEntry.create({
    data: {
      tenantId,
      ledgerEntityId: ledgerEntityId || undefined,
      entryDate,
      reference,
      description,
      status: "posted",
      createdBy: userId,
      lines: {
        create: validLines.map((l) => ({
          accountEntityId: l.accountEntityId,
          debitCents: l.debitCents,
          creditCents: l.creditCents,
          currency: l.currency,
          description: l.description,
        })),
      },
    },
  });
  revalidatePath("/dashboard/finance");
  revalidatePath("/dashboard/finance/journal");
  return {};
}

/** Update finance settings (account/ledger module slugs, default ledger). */
export async function updateFinanceSettings(_prev: unknown, formData: FormData): Promise<{ error?: string }> {
  let tenantId: string;
  try {
    tenantId = await requireFinancePermission();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { settings: true },
  });
  const settings = (tenant?.settings as Record<string, unknown>) ?? {};
  const finance = (settings.finance as Record<string, unknown>) ?? {};
  finance.accountModuleSlug = ((formData.get("accountModuleSlug") as string)?.trim()) || "account";
  finance.ledgerModuleSlug = ((formData.get("ledgerModuleSlug") as string)?.trim()) || "ledger";
  const defaultLedgerVal = (formData.get("defaultLedgerEntityId") as string)?.trim();
  finance.defaultLedgerEntityId = defaultLedgerVal || undefined;
  settings.finance = finance;
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: settings as object },
  });
  revalidatePath("/dashboard/finance");
  return {};
}

export async function addExchangeRate(_prev: unknown, formData: FormData): Promise<{ error?: string }> {
  let tenantId: string;
  try {
    tenantId = await requireFinancePermission();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }
  const fromCurrency = (formData.get("fromCurrency") as string)?.trim()?.toUpperCase().slice(0, 3);
  const toCurrency = (formData.get("toCurrency") as string)?.trim()?.toUpperCase().slice(0, 3);
  const rateStr = (formData.get("rate") as string)?.trim();
  const effectiveDateStr = (formData.get("effectiveDate") as string)?.trim();
  if (!fromCurrency || !toCurrency) return { error: "From and to currency are required." };
  if (!rateStr) return { error: "Rate is required." };
  const rate = Number(rateStr);
  if (!Number.isFinite(rate) || rate <= 0) return { error: "Rate must be a positive number." };
  if (!effectiveDateStr) return { error: "Effective date is required." };
  const effectiveDate = new Date(effectiveDateStr);
  if (Number.isNaN(effectiveDate.getTime())) return { error: "Invalid effective date." };
  try {
    await prisma.exchangeRate.create({
      data: {
        tenantId,
        fromCurrency,
        toCurrency,
        rate,
        effectiveDate,
      },
    });
  } catch (e) {
    return { error: "Duplicate or invalid rate (unique: tenant, from, to, date)." };
  }
  revalidatePath("/dashboard/finance");
  return {};
}

export async function addFiscalPeriod(_prev: unknown, formData: FormData): Promise<{ error?: string }> {
  let tenantId: string;
  try {
    tenantId = await requireFinancePermission();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }
  const periodStartStr = (formData.get("periodStart") as string)?.trim();
  const periodEndStr = (formData.get("periodEnd") as string)?.trim();
  if (!periodStartStr || !periodEndStr) return { error: "Period start and end are required." };
  const periodStart = new Date(periodStartStr);
  const periodEnd = new Date(periodEndStr);
  if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) return { error: "Invalid dates." };
  if (periodStart >= periodEnd) return { error: "Period end must be after period start." };
  try {
    await prisma.fiscalPeriod.create({
      data: { tenantId, periodStart, periodEnd },
    });
  } catch (e) {
    return { error: "Duplicate or invalid period (unique: tenant, period_start)." };
  }
  revalidatePath("/dashboard/finance");
  return {};
}

export async function closeFiscalPeriod(periodId: string): Promise<{ error?: string }> {
  let tenantId: string;
  try {
    tenantId = await requireFinancePermission();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Unauthorized" };
  }
  const userId = (await headers()).get("x-user-id")!;
  const period = await prisma.fiscalPeriod.findFirst({
    where: { id: periodId, tenantId },
  });
  if (!period) return { error: "Period not found." };
  if (period.closedAt) return { error: "Period is already closed." };
  await prisma.fiscalPeriod.update({
    where: { id: periodId },
    data: { closedAt: new Date(), closedBy: userId },
  });
  revalidatePath("/dashboard/finance");
  return {};
}
