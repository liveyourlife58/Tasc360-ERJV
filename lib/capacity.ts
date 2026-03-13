/**
 * Entity-level capacity for events/tickets: limit total quantity sold (order_lines).
 * Capacity is stored in entity.metadata.capacity (number). When set, sold + new quantity must not exceed it.
 */

import { prisma } from "./prisma";

export type Availability = {
  capacity: number | null;
  sold: number;
  available: number | null; // capacity - sold when capacity set, else null (unlimited)
};

/** Get capacity from entity.metadata.capacity and sold count from order_lines. */
export async function getEntityAvailability(
  tenantId: string,
  entityId: string
): Promise<Availability> {
  const [entity, soldResult] = await Promise.all([
    prisma.entity.findFirst({
      where: { id: entityId, tenantId, deletedAt: null },
      select: { metadata: true },
    }),
    prisma.orderLine.aggregate({
      where: { entityId },
      _sum: { quantity: true },
    }),
  ]);
  const sold = soldResult._sum.quantity ?? 0;
  if (!entity) {
    return { capacity: null, sold, available: null };
  }
  const meta = entity.metadata as Record<string, unknown> | null;
  const capacity =
    typeof meta?.capacity === "number" && meta.capacity >= 0
      ? Math.floor(meta.capacity)
      : null;
  const available =
    capacity !== null ? Math.max(0, capacity - sold) : null;
  return { capacity, sold, available };
}

/** Check if adding `quantity` to cart for this entity would exceed capacity. Returns error message or null. */
export async function checkCapacity(
  tenantId: string,
  entityId: string,
  quantity: number
): Promise<string | null> {
  const { capacity, sold, available } = await getEntityAvailability(
    tenantId,
    entityId
  );
  if (capacity === null) return null;
  if (available === null) return null;
  if (quantity <= available) return null;
  return `Only ${available} spot${available !== 1 ? "s" : ""} left. Reduce quantity and try again.`;
}
