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
import { FeedDiscovery } from "@/components/site/FeedDiscovery";
import { formatDateIfApplicable, getTenantLocale } from "@/lib/format";

const SITE_LIST_PAGE_SIZE = 24;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; segment: string }>;
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const { slug, segment } = await params;
  const { page: pageParam } = await searchParams;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { title: "Not found" };
  const module_ = await getPublicModuleBySegment(tenant.id, tenant.settings, segment);
  if (!module_) return { title: "Not found" };
  const h = await headers();
  const meta = getSiteMeta(tenant);
  const path = `/s/${slug}/${segment}`;
  const canonical = getCanonicalUrl(path, meta.canonicalBaseUrl, h);
  const description = module_.description ?? `${module_.name} – ${meta.siteName}.`;
  const title = module_.name;
  const desc = description.slice(0, 160);

  const totalCount = await prisma.entity.count({
    where: {
      tenantId: tenant.id,
      moduleId: module_.id,
      deletedAt: null,
    },
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / SITE_LIST_PAGE_SIZE));
  const page = Math.max(1, parseInt(String(pageParam ?? "1"), 10) || 1);
  const currentPage = Math.min(page, totalPages);

  const basePath = `/s/${slug}/${segment}`;
  const prev =
    currentPage > 1
      ? currentPage === 2
        ? getCanonicalUrl(basePath, meta.canonicalBaseUrl, h)
        : getCanonicalUrl(`${basePath}?page=${currentPage - 1}`, meta.canonicalBaseUrl, h)
      : undefined;
  const next =
    currentPage < totalPages
      ? getCanonicalUrl(`${basePath}?page=${currentPage + 1}`, meta.canonicalBaseUrl, h)
      : undefined;

  return {
    title,
    description: desc,
    alternates: { canonical, ...(prev && { prev }), ...(next && { next }) },
    openGraph: {
      title,
      description: desc,
      url: canonical,
      siteName: meta.siteName,
      ...(meta.ogImage && { images: [{ url: meta.ogImage, width: 1200, height: 630, alt: title }] }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      ...(meta.ogImage && { images: [meta.ogImage] }),
    },
  };
}

export default async function SiteModuleListPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; segment: string }>;
  searchParams: Promise<{ submitted?: string; page?: string }>;
}) {
  const { slug, segment } = await params;
  const { submitted, page: pageParam } = await searchParams;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  if (segment === "about" || segment === "contact") notFound();

  const module_ = await getPublicModuleBySegment(
    tenant.id,
    tenant.settings,
    segment
  );
  if (!module_) notFound();

  const page = Math.max(1, parseInt(String(pageParam ?? "1"), 10) || 1);

  const totalCount = await prisma.entity.count({
    where: {
      tenantId: tenant.id,
      moduleId: module_.id,
      deletedAt: null,
    },
  });
  const totalPages = Math.max(1, Math.ceil(totalCount / SITE_LIST_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const skip = (currentPage - 1) * SITE_LIST_PAGE_SIZE;

  const entities = await prisma.entity.findMany({
    where: {
      tenantId: tenant.id,
      moduleId: module_.id,
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    skip,
    take: SITE_LIST_PAGE_SIZE,
  });
  const locale = getTenantLocale(tenant.settings);

  const columns = module_.fields.slice(0, 6);
  const showAmountColumn = getModulePaymentType(module_) != null;

  const h = await headers();
  const meta = getSiteMeta(tenant);
  const listPath = `/s/${slug}/${segment}`;
  const listCanonical = getCanonicalUrl(listPath, meta.canonicalBaseUrl, h);
  const baseUrl = listCanonical.startsWith("http") ? listCanonical.replace(/\/?$/, "") : "";
  const homeCanonical = getCanonicalUrl(`/s/${slug}`, meta.canonicalBaseUrl, h);
  const breadcrumbListLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: homeCanonical },
      { "@type": "ListItem", position: 2, name: module_.name, item: listCanonical },
    ],
  };
  const itemListLd =
    entities.length > 0 && baseUrl
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: module_.name,
          numberOfItems: entities.length,
          itemListElement: entities.map((entity, i) => {
            const data = (entity.data as Record<string, unknown>) ?? {};
            const name =
              String(
                data[module_.fields[0]?.slug ?? "name"] ?? data.name ?? entity.id.slice(0, 8)
              ).slice(0, 120) || "Untitled";
            return {
              "@type": "ListItem",
              position: i + 1,
              url: `${baseUrl}/${entity.id}`,
              name,
            };
          }),
        }
      : null;

  const feedHref = getCanonicalUrl(listPath + "/feed", meta.canonicalBaseUrl, h);
  const feedTitle = `${module_.name} – ${meta.siteName}`;

  return (
    <div className="site-page site-module-list">
      <FeedDiscovery feedHref={feedHref} title={feedTitle} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbListLd) }}
      />
      {itemListLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd) }}
        />
      )}
      <nav className="site-detail-breadcrumb" aria-label="Breadcrumb" style={{ marginBottom: "1rem" }}>
        <Link href={`/s/${slug}`}>Home</Link>
        <span className="site-detail-breadcrumb-sep" aria-hidden>/</span>
        <span className="site-detail-breadcrumb-current">{module_.name}</span>
      </nav>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
        <h1>{module_.name}</h1>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link href={`/s/${slug}/${segment}/feed`} className="btn btn-secondary site-feed-link" aria-label={`Subscribe to ${module_.name} feed`}>
            Subscribe
          </Link>
          <Link href={`/s/${slug}/${segment}/new`} className="btn btn-primary">
            Submit new
          </Link>
        </div>
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
                    ? formatAmount(priceCents, locale)
                    : effectiveType === "donation" && suggestedCents != null && suggestedCents > 0
                      ? `Suggested: ${formatAmount(suggestedCents, locale)}`
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
                            {formatCellValue(data[f.slug], f.fieldType, locale) || title}
                          </Link>
                        ) : (
                          formatCellValue(data[f.slug], f.fieldType, locale)
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
      {totalCount > SITE_LIST_PAGE_SIZE && (
        <nav className="site-list-pagination" aria-label="Pagination" style={{ marginTop: "1.5rem", display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <p className="site-pagination-info" style={{ fontSize: "0.875rem", color: "#6b7280" }}>
            Showing {(currentPage - 1) * SITE_LIST_PAGE_SIZE + 1}–{Math.min(currentPage * SITE_LIST_PAGE_SIZE, totalCount)} of {totalCount}
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {currentPage > 1 ? (
              <Link href={currentPage === 2 ? `/s/${slug}/${segment}` : `/s/${slug}/${segment}?page=${currentPage - 1}`} className="btn btn-secondary">
                ← Previous
              </Link>
            ) : null}
            {currentPage < totalPages ? (
              <Link href={`/s/${slug}/${segment}?page=${currentPage + 1}`} className="btn btn-secondary">
                Next →
              </Link>
            ) : null}
          </div>
        </nav>
      )}
    </div>
  );
}

function formatAmount(cents: number, locale?: string): string {
  return new Intl.NumberFormat(locale || "en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatValue(value: unknown, fieldType: string, locale?: string): string {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const dateStr = formatDateIfApplicable(value, fieldType, locale);
  if (dateStr !== null && dateStr !== "") return dateStr;
  return String(value).slice(0, 40);
}

function formatCellValue(value: unknown, fieldType: string, locale?: string): React.ReactNode {
  if (fieldType === "file" && typeof value === "string" && value.trim() !== "") {
    const url = value.trim();
    if (url.startsWith("http") || url.startsWith("//"))
      return <img src={url} alt="" className="entity-list-cell-image" />;
  }
  return formatValue(value, fieldType, locale);
}
