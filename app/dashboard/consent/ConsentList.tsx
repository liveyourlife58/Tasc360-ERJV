"use client";

import { useActionState } from "react";

type ConsentRow = {
  id: string;
  consentType: string;
  grantedAt: Date;
  source: string | null;
  revokedAt: Date | null;
  user: { email: string | null; name: string | null };
};

export function ConsentList({
  consents,
  onRevoke,
}: {
  consents: ConsentRow[];
  onRevoke?: (consentId: string) => Promise<{ error?: string }>;
}) {
  if (consents.length === 0) {
    return (
      <p style={{ color: "#64748b", fontSize: "0.9375rem" }}>
        No consent records match the filters.
      </p>
    );
  }

  return (
    <table className="entity-table">
      <thead>
        <tr>
          <th>User</th>
          <th>Type</th>
          <th>Granted</th>
          <th>Source</th>
          <th>Status</th>
          {onRevoke && <th style={{ width: 100 }}></th>}
        </tr>
      </thead>
      <tbody>
        {consents.map((c) => (
          <tr key={c.id}>
            <td>{c.user?.name || c.user?.email || "—"}</td>
            <td>{c.consentType}</td>
            <td>{c.grantedAt.toLocaleString()}</td>
            <td>{c.source ?? "—"}</td>
            <td>{c.revokedAt ? `Revoked ${c.revokedAt.toLocaleString()}` : "Active"}</td>
            {onRevoke && (
              <td>
                {!c.revokedAt && (
                  <RevokeButton consentId={c.id} revokeAction={onRevoke} />
                )}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function RevokeButton({
  consentId,
  revokeAction,
}: {
  consentId: string;
  revokeAction: (id: string) => Promise<{ error?: string }>;
}) {
  const [state, formAction] = useActionState(
    async () => revokeAction(consentId),
    null as { error?: string } | null
  );
  return (
    <form action={formAction}>
      <button
        type="submit"
        className="btn btn-danger btn-sm"
        onClick={(e) => {
          if (!confirm("Revoke this consent? This will set the revocation date.")) e.preventDefault();
        }}
      >
        Revoke
      </button>
      {state?.error && (
        <span className="view-error" style={{ marginLeft: "0.5rem" }} role="alert">
          {state.error}
        </span>
      )}
    </form>
  );
}
