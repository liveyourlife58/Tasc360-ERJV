"use client";

import Link from "next/link";
import { useState, useActionState } from "react";
import { EditViewForm } from "@/components/dashboard/EditViewForm";

type ViewItem = { id: string; name: string; columns: string[] };

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
  views,
  currentViewId,
  fieldSlugs,
  updateViewAction,
  deleteViewAction,
  editViewsOpen: controlledEditViewsOpen,
  onEditViewsOpenChange,
}: {
  moduleSlug: string;
  views: ViewItem[];
  currentViewId: string | null;
  fieldSlugs: string[];
  updateViewAction: (viewId: string, moduleSlug: string, prev: unknown, formData: FormData) => Promise<unknown>;
  deleteViewAction: (viewId: string, moduleSlug: string, prev: unknown, formData: FormData) => Promise<unknown>;
  editViewsOpen?: boolean;
  onEditViewsOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const editViewsOpen = onEditViewsOpenChange ? (controlledEditViewsOpen ?? false) : internalOpen;
  const setEditViewsOpen = onEditViewsOpenChange ?? setInternalOpen;

  const [editingViewId, setEditingViewId] = useState<string | null>(null);

  const baseUrl = `/dashboard/m/${moduleSlug}`;
  const editingView = editingViewId ? views.find((v) => v.id === editingViewId) : null;

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
          <Link
            key={v.id}
            href={`${baseUrl}?view=${v.id}`}
            className={`view-tab ${currentViewId === v.id ? "active" : ""}`}
          >
            {v.name}
          </Link>
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

      {editViewsOpen && (
        <div
          className="settings-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Edit views"
          onClick={(e) => e.target === e.currentTarget && closeModal(setEditViewsOpen, setEditingViewId)}
        >
          <div className="settings-modal">
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
                    viewId={editingView.id}
                    moduleSlug={moduleSlug}
                    initialName={editingView.name}
                    initialColumns={editingView.columns}
                    fieldSlugs={fieldSlugs}
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
                          <span className="edit-views-list-name">{v.name}</span>
                          <div className="edit-views-list-actions">
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
        </div>
      )}
    </div>
  );
}
