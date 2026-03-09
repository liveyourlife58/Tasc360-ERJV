"use client";

import { useActionState } from "react";
import { addTenantUser } from "./actions";

export function AddUserForm({
  tenantId,
  roles,
}: {
  tenantId: string;
  roles: { id: string; name: string }[];
}) {
  const [state, formAction] = useActionState(
    addTenantUser.bind(null, tenantId),
    null
  );

  return (
    <form action={formAction} className="subscription-add-user-form">
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
        <div className="form-group">
          <label htmlFor="new-user-password">Password</label>
          <input
            id="new-user-password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Min 8 characters"
            className="form-control"
          />
        </div>
      </div>
      {state?.error && (
        <p className="view-error" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className="btn btn-primary">
        Add user
      </button>
    </form>
  );
}
