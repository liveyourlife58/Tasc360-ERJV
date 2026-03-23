"use client";

import Link from "next/link";
import { useMemo, useTransition } from "react";
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

export type BoardLaneSource = "data" | "all_options" | "custom";

const emptyLabel = "—";
/** Stable internal key for the unassigned lane (avoids collisions with option text "—"). */
const UNASSIGNED_KEY = "__tasc360_board_unassigned__";

type Lane = { reactKey: string; title: string; storageValue: string };

function distinctValuesInOrder(entities: Entity[], boardColumnField: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const e of entities) {
    const v = (e.data as Record<string, unknown>)?.[boardColumnField];
    if (v == null || v === "") continue;
    const s = String(v);
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

function buildLanes(
  entities: Entity[],
  boardColumnField: string,
  laneSource: BoardLaneSource,
  customLanes: string[] | undefined,
  orderedDefinedValues: string[],
  columnLabels?: Record<string, string>
): Lane[] {
  let hasUnassigned = false;
  const valueSet = new Set<string>();
  for (const e of entities) {
    const v = (e.data as Record<string, unknown>)?.[boardColumnField];
    if (v == null || v === "") hasUnassigned = true;
    else valueSet.add(String(v));
  }

  const fromData = distinctValuesInOrder(entities, boardColumnField);

  let valueLanes: string[] = [];
  if (laneSource === "all_options" && orderedDefinedValues.length > 0) {
    valueLanes = [...orderedDefinedValues];
    for (const v of valueSet) {
      if (!valueLanes.includes(v)) valueLanes.push(v);
    }
  } else if (laneSource === "custom" && customLanes && customLanes.length > 0) {
    valueLanes = [...customLanes];
    for (const v of valueSet) {
      if (!valueLanes.includes(v)) valueLanes.push(v);
    }
  } else if (orderedDefinedValues.length > 0) {
    /** "Data" mode: column order follows catalog order (select options / relation list), then any values not in catalog. */
    const seenInData = new Set(fromData);
    valueLanes = orderedDefinedValues.filter((v) => seenInData.has(v));
    for (const v of fromData) {
      if (!valueLanes.includes(v)) valueLanes.push(v);
    }
  } else {
    valueLanes = fromData;
  }

  const lanes: Lane[] = valueLanes.map((v) => ({
    reactKey: `opt:${v}`,
    title: columnLabels?.[v] ?? v,
    storageValue: v,
  }));
  if (hasUnassigned) {
    lanes.unshift({
      reactKey: UNASSIGNED_KEY,
      title: emptyLabel,
      storageValue: "",
    });
  }
  return lanes;
}

export function EntityBoard({
  moduleSlug,
  entities,
  fields,
  boardColumnField,
  boardLaneSource = "data",
  boardLaneValues,
  boardOrderedDefinedValues,
  boardColumnLabels,
  updateColumnAction,
}: {
  moduleSlug: string;
  entities: Entity[];
  fields: Field[];
  boardColumnField: string;
  boardLaneSource?: BoardLaneSource;
  boardLaneValues?: string[];
  /** Select option strings or related entity ids (in order), for “all” / “custom” lane modes. */
  boardOrderedDefinedValues: string[];
  /** When grouping by relation, map related id → display label (column headers). */
  boardColumnLabels?: Record<string, string>;
  updateColumnAction: (entityId: string, moduleSlug: string, fieldSlug: string, value: string) => Promise<{ error?: string }>;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const titleField = fields[0]?.slug ?? "name";

  const lanes = useMemo(
    () =>
      buildLanes(
        entities,
        boardColumnField,
        boardLaneSource,
        boardLaneValues,
        boardOrderedDefinedValues,
        boardColumnLabels
      ),
    [
      entities,
      boardColumnField,
      boardLaneSource,
      boardLaneValues,
      boardOrderedDefinedValues,
      boardColumnLabels,
    ]
  );

  const byLane = useMemo(() => {
    const m = new Map<string, Entity[]>();
    for (const l of lanes) {
      m.set(l.reactKey, []);
    }
    for (const e of entities) {
      const v = (e.data as Record<string, unknown>)?.[boardColumnField];
      const isEmpty = v == null || v === "";
      const key = isEmpty ? UNASSIGNED_KEY : `opt:${String(v)}`;
      const bucket = m.get(key);
      if (bucket) bucket.push(e);
    }
    return m;
  }, [lanes, entities, boardColumnField]);

  const handleDragStart = (e: React.DragEvent, entityId: string) => {
    e.dataTransfer.setData("application/entity-id", entityId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, storageValue: string) => {
    e.preventDefault();
    const entityId = e.dataTransfer.getData("application/entity-id");
    if (!entityId) return;
    startTransition(() => {
      updateColumnAction(entityId, moduleSlug, boardColumnField, storageValue).then((res) => {
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
      {lanes.map((lane) => (
        <div
          key={lane.reactKey}
          className="entity-board-column"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, lane.storageValue)}
        >
          <h3 className="entity-board-column-title">{lane.title}</h3>
          <div className="entity-board-day-events">
            {(byLane.get(lane.reactKey) ?? []).map((entity) => {
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
