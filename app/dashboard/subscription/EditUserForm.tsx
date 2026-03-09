"use client";

import { useActionState } from "react";
import { updateTenantUser } from "./actions";

export function EditUserForm({
  tenantId,
  targetUserId,
  defaultEmail,
  defaultName,
  defaultRoleId,
  defaultIsActive,
  roles,
  isEditingSelf,
  onClose,
}: {
  tenantId: string;
  targetUserId: string;
  defaultEmail: string;
  defaultName: string;
  defaultRoleId: string;
  defaultIsActive: boolean;
  roles: { id: string; name: string }[];
  isEditingSelf: boolean;
  onClose?: () => void;
}) {
  const [state, formAction] = useActionState(
    updateTenantUser.bind(null, tenantId, targetUserId),
    null
  );

  return (
    <form action={formAction} className="subscription-edit-user-form">
      <div className="form-group">
        <label htmlFor="edit-user-email">Email</label>
        <input
          id="edit-user-email"
          name="email"
          type="email"
          required
          defaultValue={defaultEmail}
          className="form-control"
        />
      </div>
      <div className="form-group">
        <label htmlFor="edit-user-name">Name</label>
        <input
          id="edit-user-name"
          name="name"
          type="text"
          defaultValue={defaultName}
          placeholder="Optional"
          className="form-control"
        />
      </div>
      <div className="form-group">
        <label htmlFor="edit-user-role">Role</label>
        <select id="edit-user-role" name="roleId" className="form-control" defaultValue={defaultRoleId || undefined}>
          <option value="">—</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="edit-user-password">New password</label>
        <input
          id="edit-user-password"
          name="password"
          type="password"
          minLength={8}
          autoComplete="new-password"
          placeholder="Leave blank to keep current password"
          className="form-control"
        />
      </div>
      <div className="form-group">
        <label className="subscription-check-label">
          <input
            type="checkbox"
            name="isActive"
            value="1"
            defaultChecked={defaultIsActive}
            disabled={isEditingSelf}
          />
          Active (user can sign in)
        </label>
      </div>
      {state?.error && (
        <p className="view-error" role="alert">
          {state.error}
        </p>
      )}
      <div className="subscription-edit-form-actions">
        <button type="submit" className="btn btn-primary">
          Save changes
        </button>
        {onClose && (
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
