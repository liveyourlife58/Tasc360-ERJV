import Link from "next/link";

type Item = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Item[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs">
      <ol className="breadcrumbs-list">
        {items.map((item, i) => (
          <li key={i} className="breadcrumbs-item">
            {i > 0 && <span className="breadcrumbs-sep" aria-hidden>/</span>}
            {item.href ? (
              <Link href={item.href} className="breadcrumbs-link">
                {item.label}
              </Link>
            ) : (
              <span className="breadcrumbs-current" aria-current="page">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
