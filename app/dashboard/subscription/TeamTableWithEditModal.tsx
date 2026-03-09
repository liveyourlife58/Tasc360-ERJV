"use client";

import { useState } from "react";
import Link from "next/link";
import { EditUserForm } from "./EditUserForm";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  createdAt: Date;
  roleId: string | null;
  role: { name: string } | null;
};

export function TeamTableWithEditModal({
  users,
  roles,
  tenantId,
  currentUserId,
  canManageUsers,
}: {
  users: UserRow[];
  roles: { id: string; name: string }[];
  tenantId: string;
  currentUserId: string;
  canManageUsers: boolean;
}) {
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);

  return (
    <>
      <div className="subscription-team-table-wrap">
        <table className="subscription-team-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th>Role</th>
              <th>Status</th>
              <th>Added</th>
              {canManageUsers && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={!u.isActive ? "subscription-team-row-inactive" : undefined}>
                <td>{u.email}</td>
                <td>{u.name ?? "—"}</td>
                <td>{u.role?.name ?? "—"}</td>
                <td>{u.isActive ? "Active" : "Inactive"}</td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                {canManageUsers && (
                  <td>
                    <button
                      type="button"
                      className="subscription-team-edit-link"
                      onClick={() => setEditingUser(u)}
                    >
                      Edit
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <div
          className="settings-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Edit user"
          onClick={(e) => e.target === e.currentTarget && setEditingUser(null)}
        >
          <div className="settings-modal subscription-edit-modal">
            <div className="settings-modal-header">
              <h2 className="settings-modal-title">Edit user</h2>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="settings-modal-close"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="settings-modal-content">
              <EditUserForm
                key={editingUser.id}
                tenantId={tenantId}
                targetUserId={editingUser.id}
                defaultEmail={editingUser.email}
                defaultName={editingUser.name ?? ""}
                defaultRoleId={editingUser.roleId ?? ""}
                defaultIsActive={editingUser.isActive}
                roles={roles}
                isEditingSelf={currentUserId === editingUser.id}
                onClose={() => setEditingUser(null)}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
