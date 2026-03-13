"use client";

import { useState } from "react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteEntity } from "@/app/dashboard/actions";
import { ConfirmModal } from "@/components/dashboard/ConfirmModal";

export function DeleteEntityButton({
  entityId,
  moduleSlug,
}: {
  entityId: string;
  moduleSlug: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    setOpen(false);
    startTransition(async () => {
      const result = await deleteEntity(entityId, moduleSlug);
      if (result?.error) alert(result.error);
      else router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-danger"
        onClick={() => setOpen(true)}
        disabled={pending}
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      <ConfirmModal
        open={open}
        title="Delete record"
        message="Delete this record? You cannot undo this."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
