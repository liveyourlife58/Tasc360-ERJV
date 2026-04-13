import type { PrismaClient } from "@prisma/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function formatTenantUserOptionLabel(u: { name: string | null; email: string }): string {
  const n = u.name?.trim();
  return n ? `${n} (${u.email})` : u.email;
}

export async function validateTenantUserFieldValues(
  prisma: PrismaClient,
  tenantId: string,
  fields: { slug: string; fieldType: string }[],
  data: Record<string, unknown>
): Promise<{ ok: true } | { ok: false; message: string }> {
  const slugs = fields.filter((f) => f.fieldType === "tenant-user").map((f) => f.slug);
  if (slugs.length === 0) return { ok: true };
  for (const slug of slugs) {
    const v = data[slug];
    if (v == null || v === "") continue;
    if (typeof v !== "string") return { ok: false, message: `Field "${slug}" must be a user id string.` };
    if (!UUID_RE.test(v)) return { ok: false, message: `Field "${slug}" has an invalid user id.` };
    const u = await prisma.user.findFirst({
      where: { id: v, tenantId, isActive: true },
      select: { id: true },
    });
    if (!u) return { ok: false, message: `Field "${slug}" must be an active user on this workspace.` };
  }
  return { ok: true };
}
