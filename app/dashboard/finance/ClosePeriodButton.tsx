"use client";

import { useActionState } from "react";

export function ClosePeriodButton({
  periodId,
  closeAction,
}: {
  periodId: string;
  closeAction: (periodId: string) => Promise<{ error?: string }>;
}) {
  const [state, formAction] = useActionState(
    async (_prev: unknown, formData: FormData) => closeAction((formData.get("periodId") as string) ?? ""),
    null as { error?: string } | null
  );
  return (
    <form action={formAction}>
      <input type="hidden" name="periodId" value={periodId} />
      <button type="submit" className="btn btn-secondary">
        Close period
      </button>
      {state?.error && <span className="view-error" role="alert" style={{ marginLeft: "0.5rem" }}>{state.error}</span>}
    </form>
  );
}
