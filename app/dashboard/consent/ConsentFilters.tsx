"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

type User = { id: string; email: string | null; name: string | null };

export function ConsentFilters({
  users,
  consentTypes,
  currentUser,
  currentType,
  activeOnly,
}: {
  users: User[];
  consentTypes: string[];
  currentUser?: string;
  currentType?: string;
  activeOnly: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const apply = useCallback(
    (user: string, type: string, active: boolean) => {
      const p = new URLSearchParams(searchParams.toString());
      if (user) p.set("user", user);
      else p.delete("user");
      if (type) p.set("type", type);
      else p.delete("type");
      if (!active) p.set("activeOnly", "0");
      else p.delete("activeOnly");
      router.push(`/dashboard/consent?${p.toString()}`);
    },
    [router, searchParams]
  );

  return (
    <div className="consent-filters" style={{ marginBottom: "1.5rem", display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "center" }}>
      <label>
        <span style={{ marginRight: "0.35rem" }}>User</span>
        <select
          value={currentUser ?? ""}
          onChange={(e) => apply(e.target.value, currentType ?? "", activeOnly)}
          aria-label="Filter by user"
        >
          <option value="">All</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name || u.email || u.id.slice(0, 8)}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span style={{ marginRight: "0.35rem" }}>Type</span>
        <select
          value={currentType ?? ""}
          onChange={(e) => apply(currentUser ?? "", e.target.value, activeOnly)}
          aria-label="Filter by consent type"
        >
          <option value="">All</option>
          {consentTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
        <input
          type="checkbox"
          checked={activeOnly}
          onChange={(e) => apply(currentUser ?? "", currentType ?? "", e.target.checked)}
          aria-label="Active only"
        />
        Active only
      </label>
    </div>
  );
}
