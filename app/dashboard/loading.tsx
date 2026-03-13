export default function DashboardLoading() {
  return (
    <div className="skeleton-page">
      <div className="skeleton-header" />
      <div className="skeleton-block" style={{ width: "60%", height: 48 }} />
      <div className="skeleton-block" style={{ width: "100%", height: 200, marginTop: "1.5rem" }} />
      <div className="skeleton-block" style={{ width: "100%", height: 120, marginTop: "1rem" }} />
    </div>
  );
}
