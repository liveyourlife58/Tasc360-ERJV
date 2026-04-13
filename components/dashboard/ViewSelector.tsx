"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useActionState } from "react";
import { createPortal } from "react-dom";
import { EditViewForm } from "@/components/dashboard/EditViewForm";

type ViewItem = {
  id: string;
  name: string;
  columns: string[];
  viewType?: string;
  settings?: {
    boardColumnField?: string;
    dateField?: string;
    boardLaneSource?: string;
    boardLaneValues?: unknown;
    boardCardFieldSlugs?: unknown;
    boardCardShowLabels?: unknown;
    boardCardLabelFieldSlugs?: unknown;
  } | null;
  filter?: unknown[];
  sort?: unknown[];
};

function InlineDeleteViewForm({
  viewId,
  viewName,
  moduleSlug,
  deleteViewAction,
}: {
  viewId: string;
  viewName: string;
  moduleSlug: string;
  deleteViewAction: (viewId: string, moduleSlug: string, prev: unknown, formData: FormData) => Promise<unknown>;
}) {
  const [, formAction] = useActionState(deleteViewAction.bind(null, viewId, moduleSlug), null);
  return (
    <form
      action={formAction}
      className="edit-views-delete-inline"
      onSubmit={(e) => {
        if (!confirm("Delete view \"" + viewName + "\"? You can't undo this.")) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="btn btn-danger edit-views-btn">
        Delete
      </button>
    </form>
  );
}

function closeModal(setEditViewsOpen: (v: boolean) => void, setEditingViewId: (v: string | null) => void) {
  setEditViewsOpen(false);
  setEditingViewId(null);
}

export function ViewSelector({
  moduleSlug,
  moduleFieldsMeta,
  views,
  currentViewId,
  fieldSlugs,
  updateViewAction,
  deleteViewAction,
  editViewsOpen: controlledEditViewsOpen,
  onEditViewsOpenChange,
  selectFieldSlugs,
  selectFieldsMeta,
  relationFieldSlugs,
  relationFieldsMeta,
  tenantUserFieldSlugs,
  tenantUserFieldsMeta,
  dateFieldSlugs,
  defaultViewId,
  setDefaultViewAction,
}: {
  moduleSlug: string;
  moduleFieldsMeta: { slug: string; name: string }[];
  views: ViewItem[];
  currentViewId: string | null;
  fieldSlugs: string[];
  updateViewAction: (viewId: string, moduleSlug: string, prev: unknown, formData: FormData) => Promise<unknown>;
  deleteViewAction: (viewId: string, moduleSlug: string, prev: unknown, formData: FormData) => Promise<unknown>;
  editViewsOpen?: boolean;
  onEditViewsOpenChange?: (open: boolean) => void;
  selectFieldSlugs?: string[];
  selectFieldsMeta?: { slug: string; name: string; options: string[] }[];
  relationFieldSlugs?: string[];
  relationFieldsMeta?: { slug: string; name: string; options: { id: string; label: string }[] }[];
  tenantUserFieldSlugs?: string[];
  tenantUserFieldsMeta?: { slug: string; name: string; options: { id: string; label: string }[] }[];
  dateFieldSlugs?: string[];
  defaultViewId?: string | null;
  setDefaultViewAction?: (moduleSlug: string, viewId: string | null) => Promise<{ error?: string }>;
}) {
  const router = useRouter();
  const [internalOpen, setInternalOpen] = useState(false);
  const editViewsOpen = onEditViewsOpenChange ? (controlledEditViewsOpen ?? false) : internalOpen;
  const setEditViewsOpen = onEditViewsOpenChange ?? setInternalOpen;

  const [editingViewId, setEditingViewId] = useState<string | null>(null);

  const baseUrl = `/dashboard/m/${moduleSlug}`;
  const editingView = editingViewId ? views.find((v) => v.id === editingViewId) : null;

  async function handleSetDefault(viewId: string | null) {
    if (!setDefaultViewAction) return;
    await setDefaultViewAction(moduleSlug, viewId);
    router.refresh();
  }

  return (
    <div className="view-selector">
      <div className="view-tabs">
        <Link
          href={baseUrl}
          className={`view-tab ${currentViewId === null ? "active" : ""}`}
        >
          All
        </Link>
        {views.map((v) => (
          <span key={v.id} className="view-tab-wrap">
            <Link
              href={`${baseUrl}?view=${v.id}`}
              className={`view-tab ${currentViewId === v.id ? "active" : ""}`}
            >
              {v.name}
              {defaultViewId === v.id ? " ★" : ""}
            </Link>
          </span>
        ))}
        {!onEditViewsOpenChange && (
          <button
            type="button"
            className="view-tab view-tab-edit-views"
            onClick={() => setEditViewsOpen(true)}
            title="Edit views"
          >
            Edit views
          </button>
        )}
      </div>

      {editViewsOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="settings-modal-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Edit views"
            onClick={(e) => e.target === e.currentTarget && closeModal(setEditViewsOpen, setEditingViewId)}
          >
            <div className="settings-modal settings-modal--wide edit-views-modal">
              <div className="settings-modal-header">
                <h2 className="settings-modal-title">
                  {editingView ? `Edit view: ${editingView.name}` : "Edit views"}
                </h2>
                <button
                  type="button"
                  onClick={() => editingViewId ? setEditingViewId(null) : closeModal(setEditViewsOpen, setEditingViewId)}
                  className="settings-modal-close"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <div className="settings-modal-content">
                {editingView ? (
                  <div className="edit-views-form-panel">
                    <button
                      type="button"
                      className="btn btn-secondary edit-views-back"
                      onClick={() => setEditingViewId(null)}
                    >
                      ← Back to list
                    </button>
                    <EditViewForm
                      key={editingView.id}
                      viewId={editingView.id}
                      moduleSlug={moduleSlug}
                      initialName={editingView.name}
                      initialColumns={editingView.columns}
                      initialViewType={(editingView.viewType === "board" || editingView.viewType === "calendar" ? editingView.viewType : "list") as "list" | "board" | "calendar"}
                      initialBoardColumnField={editingView.settings?.boardColumnField ?? null}
                      initialBoardLaneSource={editingView.settings?.boardLaneSource ?? null}
                      initialBoardLaneValues={
                        Array.isArray(editingView.settings?.boardLaneValues)
                          ? (editingView.settings?.boardLaneValues as string[]).filter((x) => typeof x === "string")
                          : null
                      }
                      initialBoardCardFieldSlugs={
                        Array.isArray(editingView.settings?.boardCardFieldSlugs)
                          ? (editingView.settings.boardCardFieldSlugs as unknown[]).filter((x): x is string => typeof x === "string")
                          : []
                      }
                      initialBoardCardShowLabels={editingView.settings?.boardCardShowLabels === true}
                      initialBoardCardLabelFieldSlugs={
                        Array.isArray(editingView.settings?.boardCardLabelFieldSlugs)
                          ? (editingView.settings.boardCardLabelFieldSlugs as unknown[]).filter((x): x is string => typeof x === "string")
                          : undefined
                      }
                      initialDateField={editingView.settings?.dateField ?? null}
                      initialFilter={Array.isArray(editingView.filter) ? editingView.filter : []}
                      initialSort={Array.isArray(editingView.sort) ? editingView.sort : []}
                      fieldSlugs={fieldSlugs}
                      moduleFieldsMeta={moduleFieldsMeta}
                      selectFieldSlugs={selectFieldSlugs ?? []}
                      selectFieldsMeta={selectFieldsMeta ?? []}
                      relationFieldSlugs={relationFieldSlugs ?? []}
                      relationFieldsMeta={relationFieldsMeta ?? []}
                      tenantUserFieldSlugs={tenantUserFieldSlugs ?? []}
                      tenantUserFieldsMeta={tenantUserFieldsMeta ?? []}
                      dateFieldSlugs={dateFieldSlugs ?? []}
                      action={updateViewAction.bind(null, editingView.id, moduleSlug)}
                      deleteAction={deleteViewAction.bind(null, editingView.id, moduleSlug)}
                    />
                  </div>
                ) : (
                <div className="edit-views-list">
                  {views.length === 0 ? (
                    <p className="edit-views-empty">No views yet. Create one with “Create view with AI”.</p>
                  ) : (
                    <ul className="edit-views-list-ul">
                      {views.map((v) => (
                        <li key={v.id} className="edit-views-list-item">
                          <span className="edit-views-list-name">
                            {v.name}
                            {defaultViewId === v.id ? " (default)" : ""}
                          </span>
                          <div className="edit-views-list-actions">
                            {setDefaultViewAction && (
                              <button
                                type="button"
                                className="btn btn-secondary edit-views-btn"
                                onClick={() => handleSetDefault(defaultViewId === v.id ? null : v.id)}
                                title={defaultViewId === v.id ? "Clear default view" : "Set as default view for this module"}
                              >
                                {defaultViewId === v.id ? "Clear default" : "Set default"}
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-secondary edit-views-btn"
                              onClick={() => setEditingViewId(v.id)}
                            >
                              Edit
                            </button>
                            <InlineDeleteViewForm
                              viewId={v.id}
                              viewName={v.name}
                              moduleSlug={moduleSlug}
                              deleteViewAction={deleteViewAction}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
