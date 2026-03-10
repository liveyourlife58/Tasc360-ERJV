import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { getTenantBySlug, getPublicModuleBySegment } from "@/lib/tenant";
import { getSiteMeta, getCanonicalUrl } from "@/lib/site-seo";
import { prisma } from "@/lib/prisma";
import {
  getModulePaymentType,
  getEffectivePaymentType,
  getEntityPriceCents,
  getEntitySuggestedDonationCents,
} from "@/lib/module-settings";
import { AddToCartButton } from "@/components/site/AddToCartButton";
import { formatDateIfApplicable } from "@/lib/format";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; segment: string }>;
}): Promise<Metadata> {
  const { slug, segment } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { title: "Not found" };
  const module_ = await getPublicModuleBySegment(tenant.id, tenant.settings, segment);
  if (!module_) return { title: "Not found" };
  const h = await headers();
  const meta = getSiteMeta(tenant);
  const path = `/s/${slug}/${segment}`;
  const canonical = getCanonicalUrl(path, meta.canonicalBaseUrl, h);
  const description = module_.description ?? `${module_.name} – ${meta.siteName}.`;
  return {
    title: module_.name,
    description: description.slice(0, 160),
    alternates: { canonical },
    openGraph: { url: canonical },
  };
}

export default async function SiteModuleListPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; segment: string }>;
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { slug, segment } = await params;
  const { submitted } = await searchParams;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  if (segment === "about" || segment === "contact") notFound();

  const module_ = await getPublicModuleBySegment(
    tenant.id,
    tenant.settings,
    segment
  );
  if (!module_) notFound();

  const entities = await prisma.entity.findMany({
    where: {
      tenantId: tenant.id,
      moduleId: module_.id,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const columns = module_.fields.slice(0, 6);
  const showAmountColumn = getModulePaymentType(module_) != null;

  return (
    <div className="site-page site-module-list">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1>{module_.name}</h1>
        <Link href={`/s/${slug}/${segment}/new`} className="btn btn-primary">
          Submit new
        </Link>
      </div>
      {submitted === "1" && (
        <p className="site-form-success" role="status">Thank you. Your submission has been received.</p>
      )}
      {entities.length === 0 ? (
        <p className="site-empty">No {module_.name.toLowerCase()} yet.</p>
      ) : (
        <div className="site-entity-list-wrap">
          <table className="site-entity-table">
            <thead>
              <tr>
                {columns.map((f) => (
                  <th key={f.id}>{f.name}</th>
                ))}
                {showAmountColumn && <th>Price / Donation</th>}
              </tr>
            </thead>
            <tbody>
              {entities.map((entity) => {
                const data = (entity.data as Record<string, unknown>) ?? {};
                const title =
                  String(
                    data[module_.fields[0]?.slug ?? "name"] ??
                      data.name ??
                      entity.id.slice(0, 8)
                  ).slice(0, 60) || "Untitled";
                const effectiveType = getEffectivePaymentType(entity, module_);
                const priceCents = getEntityPriceCents(entity);
                const suggestedCents = getEntitySuggestedDonationCents(entity);
                const amountText =
                  effectiveType === "payment" && priceCents != null && priceCents > 0
                    ? formatAmount(priceCents)
                    : effectiveType === "donation" && suggestedCents != null && suggestedCents > 0
                      ? `Suggested: ${formatAmount(suggestedCents)}`
                      : "—";
                const canAddToCart =
                  (effectiveType === "payment" && priceCents != null && priceCents > 0) ||
                  (effectiveType === "donation" && suggestedCents != null && suggestedCents > 0);
                const amountCents =
                  effectiveType === "payment" && priceCents != null && priceCents > 0
                    ? priceCents
                    : suggestedCents ?? 0;
                return (
                  <tr key={entity.id}>
                    {columns.map((f) => (
                      <td key={f.id}>
                        {f.slug === (module_.fields[0]?.slug ?? "name") ? (
                          <Link href={`/s/${slug}/${segment}/${entity.id}`} className="site-entity-list-title-cell">
                            {formatCellValue(data[f.slug], f.fieldType) || title}
                          </Link>
                        ) : (
                          formatCellValue(data[f.slug], f.fieldType)
                        )}
                      </td>
                    ))}
                    {showAmountColumn && (
                      <td>
                        {amountText}
                        {canAddToCart && (
                          <div style={{ marginTop: "0.35rem" }}>
                            <AddToCartButton
                              tenantSlug={slug}
                              segment={segment}
                              moduleSlug={module_.slug}
                              entityId={entity.id}
                              title={title}
                              amountCents={amountCents}
                              type={effectiveType === "payment" ? "payment" : "donation"}
                              label={effectiveType === "donation" ? "Add to cart" : "Add ticket"}
                            />
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatAmount(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatValue(value: unknown, fieldType: string): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const dateStr = formatDateIfApplicable(value, fieldType);
  if (dateStr !== null) return dateStr;
  return String(value).slice(0, 40);
}

function formatCellValue(value: unknown, fieldType: string): React.ReactNode {
  if (fieldType === "file" && typeof value === "string" && value.trim() !== "") {
    const url = value.trim();
    if (url.startsWith("http") || url.startsWith("//"))
      return <img src={url} alt="" className="entity-list-cell-image" />;
  }
  return formatValue(value, fieldType);
}
