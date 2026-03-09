"use client";

import { useState } from "react";
import { ViewSelector } from "@/components/dashboard/ViewSelector";
import { CreateViewAiForm } from "@/components/dashboard/CreateViewAiForm";

type ViewItem = { id: string; name: string; columns: string[] };
type CreateViewCtx = {
  tenantId: string;
  moduleId: string;
  moduleSlug: string;
  moduleName: string;
  fieldSlugs: string[];
};

export function ModuleViewSelectorRow({
  moduleSlug,
  views,
  currentViewId,
  fieldSlugs,
  updateViewAction,
  deleteViewAction,
  createViewCtx,
}: {
  moduleSlug: string;
  views: ViewItem[];
  currentViewId: string | null;
  fieldSlugs: string[];
  updateViewAction: (viewId: string, moduleSlug: string, prev: unknown, formData: FormData) => Promise<unknown>;
  deleteViewAction: (viewId: string, moduleSlug: string, prev: unknown, formData: FormData) => Promise<unknown>;
  createViewCtx: CreateViewCtx;
}) {
  const [editViewsOpen, setEditViewsOpen] = useState(false);

  return (
    <div className="view-selector-row">
      <ViewSelector
        moduleSlug={moduleSlug}
        views={views}
        currentViewId={currentViewId}
        fieldSlugs={fieldSlugs}
        updateViewAction={updateViewAction}
        deleteViewAction={deleteViewAction}
        editViewsOpen={editViewsOpen}
        onEditViewsOpenChange={setEditViewsOpen}
      />
      <div className="view-selector-float-right">
        <CreateViewAiForm ctx={createViewCtx} />
        <button
          type="button"
          className="btn btn-secondary view-tab-edit-views"
          onClick={() => setEditViewsOpen(true)}
          title="Edit views"
        >
          Edit views
        </button>
      </div>
    </div>
  );
}
