"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createRole, updateRole } from "./actions";
import { PERMISSIONS } from "@/lib/permissions";

const PERMISSION_LABELS: Record<string, string> = {
  [PERMISSIONS.entitiesRead]: "Read entities",
  [PERMISSIONS.entitiesWrite]: "Create & edit entities",
  [PERMISSIONS.modulesManage]: "Manage modules & fields",
  [PERMISSIONS.viewsManage]: "Manage views",
  [PERMISSIONS.settingsManage]: "Manage settings & billing",
  [PERMISSIONS.usersManage]: "Manage users & roles",
  "*": "Full access (admin)",
};

type RoleRow = {
  id: string;
  name: string;
  description: string | null;
  permissions: unknown;
  userCount: number;
};

export function RolesSection({
  tenantId,
  roles,
}: {
  tenantId: string;
  roles: RoleRow[];
}) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<RoleRow | null>(null);

  const [createState, createAction] = useActionState(createRole.bind(null, tenantId), null);
  const [updateState, updateAction] = useActionState(updateRole.bind(null, tenantId), null);

  const permList = Object.entries(PERMISSION_LABELS);

  return (
    <>
      <h2 className="subscription-heading">Roles ({roles.length})</h2>
      <p className="settings-hint">
        Roles define what users can do. Assign a role to each user when adding or editing them.
      </p>
      <div className="subscription-team-table-wrap">
        <table className="subscription-team-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Users</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.description ?? "—"}</td>
                <td>{r.userCount}</td>
                <td>
                  <button
                    type="button"
                    className="subscription-team-edit-link"
                    onClick={() => setEditing(r)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => setCreating(true)}
      >
        Create role
      </button>

      {creating && (
        <div
          className="settings-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Create role"
          onClick={(e) => e.target === e.currentTarget && setCreating(false)}
        >
          <div className="settings-modal subscription-edit-modal">
            <div className="settings-modal-header">
              <h2 className="settings-modal-title">Create role</h2>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="settings-modal-close"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form action={createAction} className="settings-modal-content">
              <div className="form-group">
                <label htmlFor="create-role-name">Name</label>
                <input
                  id="create-role-name"
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. Editor"
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label htmlFor="create-role-desc">Description</label>
                <input
                  id="create-role-desc"
                  name="description"
                  type="text"
                  placeholder="Optional"
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <span className="form-label">Permissions</span>
                {permList.map(([value, label]) => (
                  <label key={value} className="form-check subscription-check-label">
                    <input type="checkbox" name="permissions" value={value} />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              {createState?.error && (
                <p className="view-error" role="alert">
                  {createState.error}
                </p>
              )}
              <div className="subscription-edit-form-actions">
                <button type="submit" className="btn btn-primary">
                  Create
                </button>
                <button type="button" onClick={() => setCreating(false)} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editing && (
        <div
          className="settings-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Edit role"
          onClick={(e) => e.target === e.currentTarget && setEditing(null)}
        >
          <div className="settings-modal subscription-edit-modal">
            <div className="settings-modal-header">
              <h2 className="settings-modal-title">Edit role</h2>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="settings-modal-close"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form action={updateAction} className="settings-modal-content">
              <input type="hidden" name="roleId" value={editing.id} />
              <div className="form-group">
                <label htmlFor="edit-role-name">Name</label>
                <input
                  id="edit-role-name"
                  name="name"
                  type="text"
                  required
                  defaultValue={editing.name}
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <label htmlFor="edit-role-desc">Description</label>
                <input
                  id="edit-role-desc"
                  name="description"
                  type="text"
                  defaultValue={editing.description ?? ""}
                  placeholder="Optional"
                  className="form-control"
                />
              </div>
              <div className="form-group">
                <span className="form-label">Permissions</span>
                {permList.map(([value, label]) => {
                  const perms = Array.isArray(editing.permissions) ? editing.permissions as string[] : [];
                  const checked = perms.includes("*") || perms.includes(value);
                  return (
                    <label key={value} className="form-check subscription-check-label">
                      <input type="checkbox" name="permissions" value={value} defaultChecked={checked} />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
              {updateState?.error && (
                <p className="view-error" role="alert">
                  {updateState.error}
                </p>
              )}
              <div className="subscription-edit-form-actions">
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
                <button type="button" onClick={() => setEditing(null)} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
