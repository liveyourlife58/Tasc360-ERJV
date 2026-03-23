import Link from "next/link";
import type { InverseBacklinkSection } from "@/lib/inverse-relation-backlinks";
import {
  backlinkEntityTitle,
  formatBacklinkFieldValue,
  sourceFieldsForBacklinkGrid,
} from "@/lib/inverse-relation-backlinks";

export function InverseRelationBacklinks({
  sections,
  variant = "page",
}: {
  sections: InverseBacklinkSection[];
  /** `page`: full heading + intro; inner groups open. `list`: compact, nested under table row; groups start collapsed. */
  variant?: "page" | "list";
}) {
  if (sections.length === 0) return null;

  const groupsGap = variant === "list" ? "0.65rem" : "1.25rem";
  const groupOpen = variant === "page";
  const groupPadding = variant === "list" ? "0.5rem 0.65rem" : "0.75rem 1rem";
  const fontSize = variant === "list" ? "0.8125rem" : undefined;

  const groups = (
    <div style={{ display: "flex", flexDirection: "column", gap: groupsGap }}>
      {sections.map((sec) => {
        const gridFields = sourceFieldsForBacklinkGrid(sec.sourceFields);
        return (
          <details
            key={`${sec.sourceModuleSlug}-${sec.fieldSlug}`}
            {...(groupOpen ? { open: true } : {})}
            className="inverse-relation-backlinks-group"
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: groupPadding,
              background: variant === "list" ? "#fff" : "#fafafa",
            }}
          >
            <summary
              style={{
                cursor: "pointer",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                flexWrap: "wrap",
                fontSize,
              }}
            >
              {sec.sourceModuleName}
              <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: "0.8125rem" }}>
                ({sec.entities.length})
              </span>
            </summary>
            <ul style={{ listStyle: "none", padding: "0.75rem 0 0", margin: 0 }}>
              {sec.entities.map((ent) => {
                const dlFontSize = variant === "list" ? "0.75rem" : "0.8125rem";
                const rows = gridFields
                  .map((f) => {
                    const raw = ent.data[f.slug];
                    const shown = formatBacklinkFieldValue(raw);
                    if (!shown || shown === "—") return null;
                    return (
                      <div key={f.slug} style={{ display: "contents" }}>
                        <dt style={{ color: "#64748b", margin: 0 }}>{f.name}</dt>
                        <dd style={{ margin: 0, wordBreak: "break-word" }}>{shown}</dd>
                      </div>
                    );
                  })
                  .filter(Boolean);
                const href = `/dashboard/m/${sec.sourceModuleSlug}/${ent.id}`;
                return (
                  <li
                    key={ent.id}
                    style={{
                      borderTop: "1px solid #e2e8f0",
                      paddingTop: "0.75rem",
                      marginTop: "0.75rem",
                    }}
                  >
                    <Link
                      href={href}
                      style={{
                        display: "block",
                        color: "inherit",
                        textDecoration: "none",
                      }}
                    >
                      {rows.length > 0 ? (
                        <dl
                          style={{
                            display: "grid",
                            gridTemplateColumns: "minmax(6rem, 10rem) 1fr",
                            gap: "0.25rem 1rem",
                            fontSize: dlFontSize,
                            margin: 0,
                          }}
                        >
                          {rows}
                        </dl>
                      ) : (
                        <span
                          style={{
                            fontSize: dlFontSize,
                            textDecoration: "underline",
                            textUnderlineOffset: "2px",
                          }}
                        >
                          {backlinkEntityTitle(ent, sec.sourceFields)}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </div>
  );

  if (variant === "list") {
    return groups;
  }

  return (
    <section className="inverse-relation-backlinks" style={{ marginTop: "2rem", marginBottom: "1.5rem" }}>
      <h2 style={{ fontSize: "1.125rem", marginBottom: "0.75rem" }}>Records linking here</h2>
      <p style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "1rem" }}>
        Shown when a relation field on another module is configured to list backlinks on the target record.
      </p>
      {groups}
    </section>
  );
}
