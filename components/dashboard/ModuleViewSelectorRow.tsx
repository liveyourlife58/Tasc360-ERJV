"use client";

import { useState } from "react";
import { ViewSelector } from "@/components/dashboard/ViewSelector";
import { CreateViewAiForm } from "@/components/dashboard/CreateViewAiForm";

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
type CreateViewCtx = {
  tenantId: string;
  moduleId: string;
  moduleSlug: string;
  moduleName: string;
  fieldSlugs: string[];
};

export function ModuleViewSelectorRow({
  moduleSlug,
  moduleFieldsMeta,
  views,
  currentViewId,
  defaultViewId,
  setDefaultViewAction,
  fieldSlugs,
  selectFieldSlugs,
  selectFieldsMeta,
  relationFieldSlugs,
  relationFieldsMeta,
  tenantUserFieldSlugs,
  tenantUserFieldsMeta,
  dateFieldSlugs,
  updateViewAction,
  deleteViewAction,
  createViewCtx,
}: {
  moduleSlug: string;
  /** All module fields (slug + label) for Kanban card picker order matches Manage fields. */
  moduleFieldsMeta: { slug: string; name: string }[];
  views: ViewItem[];
  currentViewId: string | null;
  defaultViewId?: string | null;
  setDefaultViewAction?: (moduleSlug: string, viewId: string | null) => Promise<{ error?: string }>;
  fieldSlugs: string[];
  selectFieldSlugs?: string[];
  selectFieldsMeta?: { slug: string; name: string; options: string[] }[];
  relationFieldSlugs?: string[];
  relationFieldsMeta?: { slug: string; name: string; options: { id: string; label: string }[] }[];
  tenantUserFieldSlugs?: string[];
  tenantUserFieldsMeta?: { slug: string; name: string; options: { id: string; label: string }[] }[];
  dateFieldSlugs?: string[];
  updateViewAction: (viewId: string, moduleSlug: string, prev: unknown, formData: FormData) => Promise<unknown>;
  deleteViewAction: (viewId: string, moduleSlug: string, prev: unknown, formData: FormData) => Promise<unknown>;
  createViewCtx: CreateViewCtx;
}) {
  const [editViewsOpen, setEditViewsOpen] = useState(false);

  return (
    <div className="view-selector-row">
      <ViewSelector
        moduleSlug={moduleSlug}
        moduleFieldsMeta={moduleFieldsMeta}
        views={views}
        currentViewId={currentViewId}
        defaultViewId={defaultViewId}
        setDefaultViewAction={setDefaultViewAction}
        fieldSlugs={fieldSlugs}
        selectFieldSlugs={selectFieldSlugs}
        selectFieldsMeta={selectFieldsMeta}
        relationFieldSlugs={relationFieldSlugs}
        relationFieldsMeta={relationFieldsMeta}
        tenantUserFieldSlugs={tenantUserFieldSlugs}
        tenantUserFieldsMeta={tenantUserFieldsMeta}
        dateFieldSlugs={dateFieldSlugs}
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
