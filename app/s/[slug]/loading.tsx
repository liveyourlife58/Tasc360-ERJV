export default function SiteLoading() {
  return (
    <div className="site-loading" aria-live="polite" aria-busy="true">
      <div className="site-loading-main">
        <div className="site-loading-skeleton site-loading-title" />
        <div className="site-loading-skeleton site-loading-line" />
        <div className="site-loading-skeleton site-loading-line site-loading-line-short" />
      </div>
    </div>
  );
}
