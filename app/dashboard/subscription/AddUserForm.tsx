"use client";

import { useState } from "react";
import { useActionState } from "react";
import { addTenantUser } from "./actions";

export function AddUserForm({
  tenantId,
  roles,
}: {
  tenantId: string;
  roles: { id: string; name: string }[];
}) {
  const [inviteOnly, setInviteOnly] = useState(false);
  const [state, formAction] = useActionState(
    addTenantUser.bind(null, tenantId),
    null
  );

  return (
    <form action={formAction} className="subscription-add-user-form">
      <input type="hidden" name="inviteOnly" value={inviteOnly ? "1" : "0"} />
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="new-user-email">Email</label>
          <input
            id="new-user-email"
            name="email"
            type="email"
            required
            placeholder="colleague@example.com"
            className="form-control"
          />
        </div>
        <div className="form-group">
          <label htmlFor="new-user-name">Name</label>
          <input
            id="new-user-name"
            name="name"
            type="text"
            placeholder="Optional"
            className="form-control"
          />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label htmlFor="new-user-role">Role</label>
          <select id="new-user-role" name="roleId" className="form-control">
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        {!inviteOnly && (
          <div className="form-group">
            <label htmlFor="new-user-password">Password</label>
            <input
              id="new-user-password"
              name="password"
              type="password"
              minLength={8}
              autoComplete="new-password"
              placeholder="Min 8 characters"
              className="form-control"
            />
          </div>
        )}
      </div>
      <div className="form-group">
        <label className="form-check">
          <input
            type="checkbox"
            checked={inviteOnly}
            onChange={(e) => setInviteOnly(e.target.checked)}
          />
          <span>Invite by email (user sets their own password)</span>
        </label>
      </div>
      {state?.error && (
        <p className="view-error" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn btn-primary">
        {inviteOnly ? "Send invite" : "Add user"}
      </button>
    </form>
  );
}
