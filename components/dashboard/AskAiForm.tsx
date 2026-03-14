"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { askDashboardAi } from "@/app/dashboard/actions";

type CitedRecord = { entityId: string; moduleSlug: string; moduleName: string };
type AskAiState = { error?: string; answer?: string; citedRecords?: CitedRecord[] } | null;

export function AskAiForm({ moduleSlug }: { moduleSlug?: string | null }) {
  const [state, formAction] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      const question = (formData.get("question") as string)?.trim();
      return askDashboardAi(question ?? "", moduleSlug);
    },
    null as AskAiState
  );
  const [question, setQuestion] = useState("");

  const error = state?.error ?? null;
  const answer = state?.answer ?? null;
  const citedRecords = state?.citedRecords ?? [];

  return (
    <section className="ask-ai-section" style={{ marginBottom: "1.5rem" }}>
      <h2 className="subscription-subheading">Ask about your data</h2>
      <p style={{ fontSize: "0.9375rem", color: "#64748b", marginBottom: "0.75rem" }}>
        Ask in plain language (e.g. &quot;Which customers have email at gmail?&quot; or &quot;List open projects&quot;). Results use full-text and semantic search; if nothing matches, recent records are used as context.
      </p>
      <form action={formAction} className="ai-generate-form" style={{ maxWidth: 560 }}>
        <div className="form-group">
          <label htmlFor="ask-question">Question</label>
          <input
            id="ask-question"
            name="question"
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. What are the total value of open opportunities?"
            style={{ maxWidth: "100%" }}
          />
        </div>
        <button type="submit" className="btn btn-primary">
          Ask
        </button>
      </form>
      {error && <p className="view-error" role="alert">{error}</p>}
      {answer && (
        <div className="ask-ai-answer" style={{ marginTop: "1rem", padding: "1rem", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
          <div style={{ fontSize: "0.8125rem", color: "#64748b", marginBottom: "0.35rem" }}>Answer</div>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{answer}</div>
          {citedRecords.length > 0 && (
            <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "0.8125rem", color: "#64748b", marginBottom: "0.35rem" }}>Sources</div>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.875rem" }}>
                {citedRecords.map((r) => (
                  <li key={`${r.moduleSlug}-${r.entityId}`}>
                    <Link href={`/dashboard/m/${r.moduleSlug}/${r.entityId}`} className="link">
                      {r.moduleName} — {r.entityId}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
