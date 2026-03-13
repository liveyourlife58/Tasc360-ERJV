"use client";

import { restoreEntity } from "@/app/dashboard/actions";

export function RestoreEntityButton({
  entityId,
  moduleSlug,
}: {
  entityId: string;
  moduleSlug: string;
}) {
  return (
    <form action={async (_formData: FormData): Promise<void> => { await restoreEntity(entityId, moduleSlug); }}>
      <button type="submit" className="btn btn-secondary" style={{ fontSize: "0.8125rem", padding: "0.35rem 0.65rem" }}>
        Restore
      </button>
    </form>
  );
}
