"use client";

import { decideApproval } from "@/app/dashboard/actions";

export function ApproveRejectForm({ approvalId }: { approvalId: string }) {
  return (
    <div style={{ display: "flex", gap: "0.5rem" }}>
      <form action={async (_fd: FormData): Promise<void> => { await decideApproval(approvalId, "approved"); }}>
        <button type="submit" className="btn btn-primary" style={{ fontSize: "0.8125rem", padding: "0.35rem 0.65rem" }}>
          Approve
        </button>
      </form>
      <form action={async (_fd: FormData): Promise<void> => { await decideApproval(approvalId, "rejected"); }}>
        <button type="submit" className="btn btn-danger" style={{ fontSize: "0.8125rem", padding: "0.35rem 0.65rem" }}>
          Reject
        </button>
      </form>
    </div>
  );
}
