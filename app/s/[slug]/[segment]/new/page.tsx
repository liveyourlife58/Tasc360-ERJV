import { notFound } from "next/navigation";
import Link from "next/link";
import { getTenantBySlug, getPublicModuleBySegment } from "@/lib/tenant";
import { submitPublicForm } from "@/app/s/actions";
import { PublicForm } from "@/components/site/PublicForm";

export default async function SiteModuleNewPage({
  params,
}: {
  params: Promise<{ slug: string; segment: string }>;
}) {
  const { slug, segment } = await params;
  const tenant = await getTenantBySlug(slug);
  if (!tenant) notFound();
  if (segment === "about" || segment === "contact") notFound();

  const module_ = await getPublicModuleBySegment(
    tenant.id,
    tenant.settings,
    segment
  );
  if (!module_) notFound();

  return (
    <div className="site-page site-module-form">
      <h1>Submit {module_.name.slice(0, -1)}</h1>
      <PublicForm
        tenantSlug={slug}
        segment={segment}
        moduleName={module_.name}
        fields={module_.fields}
        action={submitPublicForm.bind(null, slug, segment)}
      />
      <p style={{ marginTop: "1rem" }}>
        <Link href={`/s/${slug}/${segment}`}>← Back to {module_.name}</Link>
      </p>
    </div>
  );
}
