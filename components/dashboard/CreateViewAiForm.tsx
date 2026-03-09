"use client";

import { useActionState, useState } from "react";
import { createViewFromAi } from "@/app/dashboard/actions";

type Ctx = {
  tenantId: string;
  moduleId: string;
  moduleSlug: string;
  moduleName: string;
  fieldSlugs: string[];
};

export function CreateViewAiForm({ ctx }: { ctx: Ctx }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    createViewFromAi.bind(null, ctx),
    null
  );

  if (!open) {
    return (
      <button
        type="button"
        className="btn btn-secondary view-tab view-tab-new"
        onClick={() => setOpen(true)}
      >
        + Create view with AI
      </button>
    );
  }

  return (
    <form
      action={formAction}
      className="view-new-form ai-create-view-form"
      onSubmit={() => setOpen(false)}
    >
      <input
        name="prompt"
        placeholder="e.g. Show all where status is In Progress, sorted by due date"
        className="view-new-input ai-view-prompt"
      />
      <button type="submit" className="btn btn-primary view-new-btn">
        Create view
      </button>
      <button
        type="button"
        className="btn btn-secondary view-new-btn"
        onClick={() => setOpen(false)}
      >
        Cancel
      </button>
      {state && typeof state === "object" && "error" in state && (
        <span className="view-error">{(state as { error: string }).error}</span>
      )}
    </form>
  );
}
