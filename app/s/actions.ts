"use server";

import { redirect } from "next/navigation";
import { getTenantBySlug, getPublicModuleBySegment } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";

export type PublicFormState = { error?: string; success?: boolean };

export async function submitPublicForm(
  tenantSlug: string,
  segment: string,
  _prev: unknown,
  formData: FormData
): Promise<PublicFormState> {
  const tenant = await getTenantBySlug(tenantSlug);
  if (!tenant) return { error: "Invalid request." };
  const module_ = await getPublicModuleBySegment(
    tenant.id,
    tenant.settings,
    segment
  );
  if (!module_) return { error: "Invalid request." };

  const data: Record<string, unknown> = {};
  const fieldSlugs = new Set(module_.fields.map((f) => f.slug));
  for (const [key, value] of formData.entries()) {
    if (!fieldSlugs.has(key)) continue;
    const v = value as string;
    if (v === "true") data[key] = true;
    else if (v === "false") data[key] = false;
    else if (v && !Number.isNaN(Number(v)) && v.trim() !== "") data[key] = Number(v);
    else data[key] = v || null;
  }

  const searchText = Object.values(data)
    .filter((v) => typeof v === "string" && v)
    .join(" ");

  await prisma.entity.create({
    data: {
      tenantId: tenant.id,
      moduleId: module_.id,
      data: data as object,
      searchText: searchText.slice(0, 10000) || null,
    },
  });

  redirect(`/s/${tenantSlug}/${segment}?submitted=1`);
}
