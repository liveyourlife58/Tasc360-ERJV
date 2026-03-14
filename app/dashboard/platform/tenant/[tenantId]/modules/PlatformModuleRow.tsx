"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { ConfirmModal } from "@/components/dashboard/ConfirmModal";

type ModuleRow = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  entityCount: number;
};

export function PlatformModuleRow({
  tenantId,
  module: m,
  disableFormAction,
  enableFormAction,
  deleteFormAction,
}: {
  tenantId: string;
  module: ModuleRow;
  /** Form action: receives formData when form is submitted (server action supports both 1-arg and useActionState 2-arg). */
  disableFormAction: (formData: FormData) => void | Promise<void>;
  enableFormAction: (formData: FormData) => void | Promise<void>;
  deleteFormAction: (formData: FormData) => void | Promise<void>;
}) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const deleteFormRef = useRef<HTMLFormElement>(null);

  const canDelete = m.entityCount === 0;

  return (
    <tr>
      <td>
        {m.isActive ? (
          <Link
            href={`/dashboard/platform/tenant/${tenantId}/modules/${m.slug}/fields`}
            className="dashboard-table-link"
          >
            {m.name}
          </Link>
        ) : (
          <>
            <span style={{ color: "#94a3b8" }}>{m.name}</span>
            <Link
              href={`/dashboard/platform/tenant/${tenantId}/modules/${m.slug}/fields`}
              className="btn btn-secondary"
              style={{ marginLeft: "0.5rem", fontSize: "0.8125rem" }}
            >
              Fields
            </Link>
          </>
        )}
      </td>
      <td><code>{m.slug}</code></td>
      <td>{m.isActive ? "Active" : "Disabled"}</td>
      <td>{m.entityCount}</td>
      <td>
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          {m.isActive && (
            <form action={disableFormAction} style={{ display: "inline" }}>
              <input type="hidden" name="targetTenantId" value={tenantId} />
              <input type="hidden" name="moduleSlug" value={m.slug} />
              <button type="submit" className="btn btn-secondary" style={{ fontSize: "0.8125rem" }}>
                Disable
              </button>
            </form>
          )}
          {!m.isActive && (
            <form action={enableFormAction} style={{ display: "inline" }}>
              <input type="hidden" name="targetTenantId" value={tenantId} />
              <input type="hidden" name="moduleSlug" value={m.slug} />
              <button type="submit" className="btn btn-secondary" style={{ fontSize: "0.8125rem" }}>
                Enable
              </button>
            </form>
          )}
          {m.isActive && (
            <form ref={deleteFormRef} action={deleteFormAction} style={{ display: "inline" }}>
              <input type="hidden" name="targetTenantId" value={tenantId} />
              <input type="hidden" name="moduleSlug" value={m.slug} />
              <button
                type="button"
                className="btn btn-danger"
                style={{ fontSize: "0.8125rem" }}
                disabled={!canDelete}
                title={!canDelete ? `Cannot delete: ${m.entityCount} record(s) exist. Remove records first.` : "Delete module"}
                onClick={() => canDelete && setDeleteConfirmOpen(true)}
              >
                Delete
              </button>
            </form>
          )}
        </div>
      </td>
      <ConfirmModal
        open={deleteConfirmOpen}
        title="Delete module"
        message={`Delete module "${m.name}"? This cannot be undone. All fields and views for this module will be removed.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          setDeleteConfirmOpen(false);
          deleteFormRef.current?.requestSubmit();
        }}
        onCancel={() => setDeleteConfirmOpen(false)}
      />
    </tr>
  );
}
