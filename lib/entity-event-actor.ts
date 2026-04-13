import { prisma } from "@/lib/prisma";

/** Snapshot for entity audit events so actor remains visible if the User row is removed later. */
export async function entityEventActorPayload(
  userId: string | null | undefined
): Promise<Record<string, string>> {
  if (!userId) return {};
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!u) return { actorUserId: userId };
  const name = u.name?.trim();
  return {
    actorUserId: userId,
    actorEmail: u.email,
    ...(name ? { actorName: name } : {}),
  };
}

type CreatedByUserShape = { email: string; name: string | null } | null | undefined;

/**
 * Human-readable actor for entity-related events: prefers JSON snapshot (survives user delete),
 * then joined user, then API.
 */
export function formatEntityEventActorLabel(
  data: Record<string, unknown> | null | undefined,
  createdByUser: CreatedByUserShape
): string {
  const d = data ?? {};
  const name = typeof d.actorName === "string" ? d.actorName.trim() : "";
  if (name) return name;
  const email = typeof d.actorEmail === "string" ? d.actorEmail.trim() : "";
  if (email) return "User";
  if (createdByUser) {
    const n = createdByUser.name?.trim();
    if (n) return n;
    return "User";
  }
  if (d.source === "api") {
    const p = typeof d.apiKeyPrefix === "string" && d.apiKeyPrefix ? ` key ${d.apiKeyPrefix}…` : "";
    return `API${p}`;
  }
  return "—";
}
