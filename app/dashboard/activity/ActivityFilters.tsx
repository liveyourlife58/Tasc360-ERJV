"use client";

export function ActivityFilters({
  users,
  modules,
  currentUser,
  currentEventType,
  currentModule,
  currentDateFrom,
  currentDateTo,
}: {
  users: { id: string; email: string; name: string | null }[];
  modules: { slug: string; name: string }[];
  currentUser: string | null;
  currentEventType: string | null;
  currentModule: string | null;
  currentDateFrom: string | null;
  currentDateTo: string | null;
}) {
  return (
    <form method="get" className="subscription-add-user-form" style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-end" }}>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label htmlFor="activity-user">User</label>
        <select id="activity-user" name="user" className="form-control" defaultValue={currentUser ?? ""}>
          <option value="">All</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>{u.name || u.email}</option>
          ))}
        </select>
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label htmlFor="activity-type">Event type</label>
        <select id="activity-type" name="eventType" className="form-control" defaultValue={currentEventType ?? ""}>
          <option value="">All</option>
          <option value="entity_created">Created</option>
          <option value="entity_updated">Updated</option>
          <option value="entity_deleted">Deleted</option>
        </select>
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label htmlFor="activity-module">Module</label>
        <select id="activity-module" name="module" className="form-control" defaultValue={currentModule ?? ""}>
          <option value="">All</option>
          {modules.map((m) => (
            <option key={m.slug} value={m.slug}>{m.name}</option>
          ))}
        </select>
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label htmlFor="activity-dateFrom">From date</label>
        <input id="activity-dateFrom" name="dateFrom" type="date" className="form-control" defaultValue={currentDateFrom ?? ""} />
      </div>
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label htmlFor="activity-dateTo">To date</label>
        <input id="activity-dateTo" name="dateTo" type="date" className="form-control" defaultValue={currentDateTo ?? ""} />
      </div>
      <button type="submit" className="btn btn-primary">Filter</button>
    </form>
  );
}
