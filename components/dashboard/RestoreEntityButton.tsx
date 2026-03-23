"use client";

import { restoreEntity, restoreEntityAsPlatformAdmin } from "@/app/dashboard/actions";

export function RestoreEntityButton({
  entityId,
  moduleSlug,
  platformAdmin,
}: {
  entityId: string;
  moduleSlug: string;
  /** Use platform-admin restore (no tenant entities:write required). */
  platformAdmin?: boolean;
}) {
  const restore = platformAdmin ? restoreEntityAsPlatformAdmin : restoreEntity;
  return (
    <form action={async (): Promise<void> => { await restore(entityId, moduleSlug); }}>
      <button type="submit" className="btn btn-secondary" style={{ fontSize: "0.8125rem", padding: "0.35rem 0.65rem" }}>
        Restore
      </button>
    </form>
  );
}
