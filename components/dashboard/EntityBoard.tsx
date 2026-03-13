"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";

type Field = {
  id: string;
  name: string;
  slug: string;
  fieldType: string;
  settings?: Record<string, unknown>;
};

type Entity = {
  id: string;
  data: Record<string, unknown> | unknown;
};

const emptyLabel = "—";

export function EntityBoard({
  moduleSlug,
  entities,
  fields,
  boardColumnField,
  updateColumnAction,
}: {
  moduleSlug: string;
  entities: Entity[];
  fields: Field[];
  boardColumnField: string;
  updateColumnAction: (entityId: string, moduleSlug: string, fieldSlug: string, value: string) => Promise<{ error?: string }>;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const titleField = fields[0]?.slug ?? "name";
  const columnValues = new Set<string>();
  entities.forEach((e) => {
    const v = (e.data as Record<string, unknown>)?.[boardColumnField];
    if (v != null && v !== "") columnValues.add(String(v));
  });
  const columns = Array.from(columnValues);
  const allColumns = [emptyLabel, ...columns];

  const byColumn = new Map<string, Entity[]>();
  allColumns.forEach((c) => byColumn.set(c, []));
  entities.forEach((e) => {
    const v = (e.data as Record<string, unknown>)?.[boardColumnField];
    const key = v != null && v !== "" ? String(v) : emptyLabel;
    byColumn.get(key)?.push(e);
  });

  const handleDragStart = (e: React.DragEvent, entityId: string) => {
    e.dataTransfer.setData("application/entity-id", entityId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, columnValue: string) => {
    e.preventDefault();
    const entityId = e.dataTransfer.getData("application/entity-id");
    if (!entityId) return;
    const value = columnValue === emptyLabel ? "" : columnValue;
    startTransition(() => {
      updateColumnAction(entityId, moduleSlug, boardColumnField, value).then((res) => {
        if (res?.error) alert(res.error);
        else router.refresh();
      });
    });
  };

  if (entities.length === 0) {
    return (
      <div className={`entity-board entity-board--empty${isPending ? " is-pending" : ""}`}>
        <div className="empty-state">
          <span className="empty-state-icon" aria-hidden>📋</span>
          <p className="empty-state-title">No records yet</p>
          <p className="empty-state-message">Create a record to see it on the board. You can drag cards between columns to update their status.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`entity-board${isPending ? " is-pending" : ""}`}>
      {allColumns.map((col) => (
        <div
          key={col}
          className="entity-board-column"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, col)}
        >
          <h3 className="entity-board-column-title">{col}</h3>
          <div className="entity-board-day-events">
            {(byColumn.get(col) ?? []).map((entity) => {
              const title = String((entity.data as Record<string, unknown>)?.[titleField] ?? "Untitled");
              return (
                <div
                  key={entity.id}
                  className="entity-board-card"
                  draggable
                  onDragStart={(e) => handleDragStart(e, entity.id)}
                  style={{ cursor: "grab" }}
                >
                  <Link href={`/dashboard/m/${moduleSlug}/${entity.id}`} onClick={(e) => e.stopPropagation()}>
                    {title}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
