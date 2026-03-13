"use client";

import Link from "next/link";
import { useState } from "react";

type Field = {
  id: string;
  name: string;
  slug: string;
  fieldType: string;
};

type Entity = {
  id: string;
  data: Record<string, unknown> | unknown;
};

function getMonthDays(year: number, month: number): { date: Date; isCurrentMonth: boolean }[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const daysInMonth = last.getDate();
  const result: { date: Date; isCurrentMonth: boolean }[] = [];
  for (let i = 0; i < startPad; i++) {
    const d = new Date(year, month, 1 - (startPad - i));
    result.push({ date: d, isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    result.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }
  const remaining = 42 - result.length;
  for (let i = 0; i < remaining; i++) {
    result.push({ date: new Date(year, month, daysInMonth + i + 1), isCurrentMonth: false });
  }
  return result;
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function EntityCalendar({
  moduleSlug,
  entities,
  fields,
  dateField,
}: {
  moduleSlug: string;
  entities: Entity[];
  fields: Field[];
  dateField: string;
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const titleField = fields[0]?.slug ?? "name";
  const byDate = new Map<string, Entity[]>();
  entities.forEach((e) => {
    const raw = (e.data as Record<string, unknown>)?.[dateField];
    if (raw == null) return;
    const d = typeof raw === "string" ? new Date(raw) : raw instanceof Date ? raw : null;
    if (!d || Number.isNaN(d.getTime())) return;
    const key = dateKey(d);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(e);
  });

  const days = getMonthDays(year, month);
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const hasAnyInMonth = days.some(({ date }) => byDate.has(dateKey(date)));

  const goPrev = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };
  const goNext = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  return (
    <div className="entity-calendar">
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
        <button type="button" onClick={goPrev} className="btn btn-secondary">
          ← Previous
        </button>
        <h2 style={{ margin: 0, fontSize: "1.25rem" }}>
          {MONTH_NAMES[month]} {year}
        </h2>
        <button type="button" onClick={goNext} className="btn btn-secondary">
          Next →
        </button>
      </div>
      {entities.length > 0 && !hasAnyInMonth && (
        <p className="entity-calendar-empty-hint">No records with dates in this month.</p>
      )}
      <div className="entity-calendar-grid" style={{ gridTemplateRows: `auto repeat(6, 1fr)` }}>
        {weekDays.map((wd) => (
          <div key={wd} className="entity-calendar-day" style={{ background: "#f8fafc", fontWeight: 600 }}>
            {wd}
          </div>
        ))}
        {days.map(({ date, isCurrentMonth }, i) => {
          const key = dateKey(date);
          const dayEntities = byDate.get(key) ?? [];
          return (
            <div
              key={i}
              className="entity-calendar-day"
              style={{ background: isCurrentMonth ? "#fff" : "#f8fafc", opacity: isCurrentMonth ? 1 : 0.7 }}
            >
              <div className="entity-calendar-day-header">{date.getDate()}</div>
              <div className="entity-calendar-day-events">
                {dayEntities.map((entity) => {
                  const title = String((entity.data as Record<string, unknown>)?.[titleField] ?? "Untitled");
                  return (
                    <div key={entity.id} className="entity-calendar-event">
                      <Link href={`/dashboard/m/${moduleSlug}/${entity.id}`}>{title}</Link>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
