import { notFound } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import type { Metadata } from "next";
import { getTenantBySlug, getPublicModuleBySegment } from "@/lib/tenant";
import { getSiteMeta, getCanonicalUrl } from "@/lib/site-seo";
import { prisma } from "@/lib/prisma";
import {
  getEffectivePaymentType,
  getEntityPriceCents,
  getEntitySuggestedDonationCents,
} from "@/lib/module-settings";
import { AddToCartButton } from "@/components/site/AddToCartButton";
import { JoinWaitlistForm } from "@/components/site/JoinWaitlistForm";
import { ShareButton } from "@/components/site/ShareButton";
import { formatDateIfApplicable, getTenantLocale } from "@/lib/format";
import { getEntityAvailabilityForSite } from "@/app/s/actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; segment: string; id: string }>;
}): Promise<Metadata> {
  const { slug, segment, id } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) return { title: "Not found" };
  const module_ = await getPublicModuleBySegment(tenant.id, tenant.settings, segment);
  if (!module_) return { title: "Not found" };
  const entity = await prisma.entity.findFirst({
    where: { id, tenantId: tenant.id, moduleId: module_.id, deletedAt: null },
  });
  if (!entity) return { title: "Not found" };
  const data = (entity.data as Record<string, unknown>) ?? {};
  const entityMeta = (entity.metadata as Record<string, unknown>) ?? {};
  const title = (entityMeta.metaTitle as string) ?? String(data[module_.fields[0]?.slug ?? "name"] ?? data.name ?? "Untitled").slice(0, 60);
  const descRaw = (entityMeta.metaDescription as string) ?? (data.description as string) ?? (data.notes as string) ?? "";
  const description = descRaw ? String(descRaw).slice(0, 160) : `${module_.name} – ${title}.`;
  const h = await headers();
  const meta = getSiteMeta(tenant);
  const path = `/s/${slug}/${segment}/${id}`;
  const canonical = getCanonicalUrl(path, meta.canonicalBaseUrl, h);
  const ogImage = (entityMeta.ogImage as string) ?? meta.ogImage;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      url: canonical,
      type: "article",
      ...(ogImage && { images: [{ url: ogImage, alt: title }] }),
    },
    twitter: { card: "summary_large_image", ...(ogImage && { images: [ogImage] }) },
  };
}

export default async function SiteModuleDetailPage({
  params,
}: {
  params: Promise<{ slug: string; segment: string; id: string }>;
}) {
  const { slug, segment, id } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  if (segment === "about" || segment === "contact") notFound();

  const module_ = await getPublicModuleBySegment(
    tenant.id,
    tenant.settings,
    segment
  );
  if (!module_) notFound();

  const entity = await prisma.entity.findFirst({
    where: {
      id,
      tenantId: tenant.id,
      moduleId: module_.id,
      deletedAt: null,
    },
  });
  if (!entity) notFound();

  const data = (entity.data as Record<string, unknown>) ?? {};
  const locale = getTenantLocale(tenant.settings);
  const availability = await getEntityAvailabilityForSite(slug, entity.id);
  const effectiveType = getEffectivePaymentType(entity, module_);
  const priceCents = getEntityPriceCents(entity);
  const suggestedCents = getEntitySuggestedDonationCents(entity);
  const amountLabel =
    effectiveType === "payment" && priceCents != null && priceCents > 0
      ? { label: "Price", value: formatAmount(priceCents, locale) }
      : effectiveType === "donation" && suggestedCents != null && suggestedCents > 0
        ? { label: "Suggested donation", value: formatAmount(suggestedCents, locale) }
        : null;

  const h = await headers();
  const meta = getSiteMeta(tenant);
  const path = `/s/${slug}/${segment}/${id}`;
  const canonical = getCanonicalUrl(path, meta.canonicalBaseUrl, h);
  const title = String(data[module_.fields[0]?.slug ?? "name"] ?? data.name ?? "Untitled").slice(0, 80) || "Untitled";
  const dateField = module_.fields.find((f) => f.fieldType === "date");
  const dateVal = dateField ? data[dateField.slug] : undefined;
  const dateStr =
    dateVal != null && typeof dateVal === "string"
      ? dateVal
      : dateVal != null && typeof (dateVal as { toISOString?: () => string }).toISOString === "function"
        ? (dateVal as Date).toISOString()
        : undefined;
  const isProduct =
    effectiveType === "payment" && priceCents != null && priceCents > 0;
  const jsonLd =
    module_.slug === "events" && dateStr
      ? {
          "@context": "https://schema.org",
          "@type": "Event",
          name: title,
          startDate: dateStr,
          ...(typeof data.participant_count === "number" && { maximumAttendeeCapacity: data.participant_count }),
          ...(canonical.startsWith("http") && { url: canonical }),
        }
      : isProduct
        ? {
            "@context": "https://schema.org",
            "@type": "Product",
            name: title,
            ...(canonical.startsWith("http") && { url: canonical }),
            offers: {
              "@type": "Offer",
              price: (priceCents ?? 0) / 100,
              priceCurrency: "USD",
            },
          }
        : {
            "@context": "https://schema.org",
            "@type": "Thing",
            name: title,
            ...(canonical.startsWith("http") && { url: canonical }),
          };

  const listPath = `/s/${slug}/${segment}`;
  const listCanonical = getCanonicalUrl(listPath, meta.canonicalBaseUrl, h);
  const homeCanonical = getCanonicalUrl(`/s/${slug}`, meta.canonicalBaseUrl, h);
  const breadcrumbListLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: homeCanonical },
      { "@type": "ListItem", position: 2, name: module_.name, item: listCanonical },
      { "@type": "ListItem", position: 3, name: title, item: canonical },
    ],
  };

  return (
    <div className="site-page site-module-detail">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbListLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <nav className="site-detail-breadcrumb" aria-label="Breadcrumb">
        <Link href={`/s/${slug}`}>Home</Link>
        <span className="site-detail-breadcrumb-sep" aria-hidden>/</span>
        <Link href={`/s/${slug}/${segment}`}>{module_.name}</Link>
        <span className="site-detail-breadcrumb-sep" aria-hidden>/</span>
        <span className="site-detail-breadcrumb-current">{title}</span>
      </nav>
      <header className="site-detail-header">
        <span className="site-detail-module-label">{module_.name}</span>
        <h1 className="site-detail-title">{title}</h1>
        {amountLabel && (
          <p className="site-detail-price">
            <span className="site-detail-price-label">{amountLabel.label}:</span>{" "}
            <span className="site-detail-price-value">{amountLabel.value}</span>
          </p>
        )}
      </header>
      <section className="site-detail-card" aria-label="Details">
        <dl className="site-detail-list">
          {module_.fields.map((f) => (
            <div key={f.id} className="site-detail-row">
              <dt>{f.name}</dt>
              <dd>{formatDetailValue(data[f.slug], f.fieldType, locale)}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className="site-detail-actions">
        {amountLabel && availability?.available === 0 && availability?.capacity !== null ? (
          <div className="site-sold-out">
            <p className="site-sold-out-text">Sold out</p>
            <JoinWaitlistForm tenantSlug={slug} entityId={entity.id} />
          </div>
        ) : amountLabel ? (
          <AddToCartButton
            tenantSlug={slug}
            segment={segment}
            moduleSlug={module_.slug}
            entityId={entity.id}
            title={title}
            amountCents={priceCents ?? suggestedCents ?? 0}
            type={effectiveType === "payment" ? "payment" : "donation"}
            label={effectiveType === "donation" ? "Add to cart" : "Add ticket"}
            maxQuantity={availability?.available ?? undefined}
          />
        ) : null}
        {availability?.capacity != null && availability.available != null && availability.available > 0 && (
          <p className="site-spots-left" style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.25rem" }}>
            {availability.available} spot{availability.available !== 1 ? "s" : ""} left
          </p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
          <ShareButton url={canonical} title={title} />
          <Link href={`/s/${slug}/${segment}`} className="btn btn-secondary site-detail-back">
            ← Back to {module_.name}
          </Link>
        </div>
      </div>
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

function formatDetailValue(value: unknown, fieldType: string, locale?: string): React.ReactNode {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const dateStr = formatDateIfApplicable(value, fieldType, locale);
  if (dateStr !== null && dateStr !== "") return dateStr;
  if (fieldType === "json" && typeof value === "object")
    return <pre className="site-json">{JSON.stringify(value, null, 2)}</pre>;
  if (fieldType === "file" && typeof value === "string" && value.trim() !== "") {
    const url = value.trim();
    if (url.startsWith("http") || url.startsWith("//"))
      return <img src={url} alt="" className="site-detail-image" />;
    return url;
  }
  return String(value);
}
