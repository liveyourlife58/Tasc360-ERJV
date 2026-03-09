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
import { formatDateIfApplicable } from "@/lib/format";

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
  const effectiveType = getEffectivePaymentType(entity, module_);
  const priceCents = getEntityPriceCents(entity);
  const suggestedCents = getEntitySuggestedDonationCents(entity);
  const amountLabel =
    effectiveType === "payment" && priceCents != null && priceCents > 0
      ? { label: "Price", value: formatAmount(priceCents) }
      : effectiveType === "donation" && suggestedCents != null && suggestedCents > 0
        ? { label: "Suggested donation", value: formatAmount(suggestedCents) }
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
      : {
          "@context": "https://schema.org",
          "@type": "Thing",
          name: title,
          ...(canonical.startsWith("http") && { url: canonical }),
        };

  return (
    <div className="site-page site-module-detail">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <p className="site-breadcrumb">
        <Link href={`/s/${slug}`}>Home</Link>
        {" / "}
        <Link href={`/s/${slug}/${segment}`}>{module_.name}</Link>
        {" / "}
        <span>Detail</span>
      </p>
      <h1>{title}</h1>
      <dl className="site-detail-list">
        {module_.fields.map((f) => (
          <div key={f.id} className="site-detail-row">
            <dt>{f.name}</dt>
            <dd>{formatDetailValue(data[f.slug], f.fieldType)}</dd>
          </div>
        ))}
        {amountLabel && (
          <div className="site-detail-row">
            <dt>{amountLabel.label}</dt>
            <dd>{amountLabel.value}</dd>
          </div>
        )}
      </dl>
      {amountLabel && (
        <p style={{ marginTop: "1rem" }}>
          <AddToCartButton
            tenantSlug={slug}
            segment={segment}
            moduleSlug={module_.slug}
            entityId={entity.id}
            title={title}
            amountCents={priceCents ?? suggestedCents ?? 0}
            type={effectiveType === "payment" ? "payment" : "donation"}
            label={effectiveType === "donation" ? "Add to cart" : "Add ticket"}
          />
        </p>
      )}
      <p>
        <Link href={`/s/${slug}/${segment}`} className="btn btn-secondary">
          ← Back to {module_.name}
        </Link>
      </p>
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

function formatDetailValue(value: unknown, fieldType: string): React.ReactNode {
  if (value == null) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const dateStr = formatDateIfApplicable(value, fieldType);
  if (dateStr !== null) return dateStr;
  if (fieldType === "json" && typeof value === "object")
    return <pre className="site-json">{JSON.stringify(value, null, 2)}</pre>;
  return String(value);
}
