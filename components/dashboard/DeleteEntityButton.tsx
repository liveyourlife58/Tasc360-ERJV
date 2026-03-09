"use client";

import { useTransition } from "react";
import { deleteEntity } from "@/app/dashboard/actions";

export function DeleteEntityButton({
  entityId,
  moduleSlug,
}: {
  entityId: string;
  moduleSlug: string;
}) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Delete this record? You can’t undo this.")) return;
    startTransition(async () => {
      const result = await deleteEntity(entityId, moduleSlug);
      if (result?.error) alert(result.error);
    });
  }

  return (
    <button
      type="button"
      className="btn btn-danger"
      onClick={handleClick}
      disabled={pending}
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
