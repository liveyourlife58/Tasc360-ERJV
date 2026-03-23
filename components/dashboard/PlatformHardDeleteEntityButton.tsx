"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { hardDeleteEntityAsPlatformAdmin } from "@/app/dashboard/actions";
import { ConfirmModal } from "@/components/dashboard/ConfirmModal";

export function PlatformHardDeleteEntityButton({
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
      const result = await hardDeleteEntityAsPlatformAdmin(entityId, moduleSlug);
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
        title="Platform admin: remove row from database"
      >
        {pending ? "Removing…" : "Permanently delete"}
      </button>
      <ConfirmModal
        open={open}
        title="Permanently delete record"
        message="This removes the database row and cannot be undone. Blocked if orders, payments, or ledger accounts reference this record."
        confirmLabel="Permanently delete"
        variant="danger"
        onConfirm={handleConfirm}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
