"use client";

import Link from "next/link";
import { useState } from "react";

type CitedRecord = { entityId: string; moduleSlug: string; moduleName: string };

export function AskAiForm({ moduleSlug }: { moduleSlug?: string | null }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [citedRecords, setCitedRecords] = useState<CitedRecord[]>([]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    setError(null);
    setAnswer(null);
    setCitedRecords([]);
    setLoading(true);

    try {
      const res = await fetch("/api/dashboard/ask-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ question: q, moduleSlug: moduleSlug ?? null }),
      });

      const contentType = res.headers.get("Content-Type") ?? "";
      if (!res.ok) {
        if (contentType.includes("application/json")) {
          const data = await res.json().catch(() => ({}));
          setError((data.error as string) || "Something went wrong.");
        } else {
          setError(res.status === 401 ? "Please sign in again." : "Something went wrong.");
        }
        setLoading(false);
        return;
      }

      // Streaming NDJSON response
      if (contentType.includes("application/x-ndjson") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullAnswer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const data = JSON.parse(trimmed) as {
                type: string;
                citedRecords?: CitedRecord[];
                text?: string;
                message?: string;
              };
              if (data.type === "meta" && Array.isArray(data.citedRecords)) {
                setCitedRecords(data.citedRecords);
              } else if (data.type === "chunk" && typeof data.text === "string") {
                fullAnswer += data.text;
                setAnswer(fullAnswer);
              } else if (data.type === "error" && typeof data.message === "string") {
                setError(data.message);
                setAnswer(null);
              }
            } catch {
              // skip malformed line
            }
          }
        }
        if (fullAnswer && !error) {
          setAnswer(fullAnswer.trim() || "No answer generated.");
        }
      } else {
        // Non-streaming JSON (e.g. no-data response)
        const data = await res.json();
        if (typeof data.answer === "string") {
          setAnswer(data.answer);
          if (Array.isArray(data.citedRecords)) setCitedRecords(data.citedRecords);
        } else {
          setError((data.error as string) || "Something went wrong.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="ask-ai-section" style={{ marginBottom: "1.5rem" }}>
      <h2 className="subscription-subheading">Ask about your data</h2>
      <p style={{ fontSize: "0.9375rem", color: "#64748b", marginBottom: "0.75rem" }}>
        Ask in plain language (e.g. &quot;Which customers have email at gmail?&quot; or &quot;List open projects&quot;). Results use full-text and semantic search; if nothing matches, recent records are used as context. Answers stream as they are generated.
      </p>
      <form onSubmit={handleSubmit} className="ai-generate-form" style={{ maxWidth: 560 }}>
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
            disabled={loading}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Asking…" : "Ask"}
        </button>
      </form>
      {error && (
        <p className="view-error" role="alert">
          {error}
        </p>
      )}
      {answer != null && (
        <div
          className="ask-ai-answer"
          style={{
            marginTop: "1rem",
            padding: "1rem",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
          }}
        >
          <div style={{ fontSize: "0.8125rem", color: "#64748b", marginBottom: "0.35rem" }}>
            Answer
          </div>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
            {answer}
            {loading && <span className="ask-ai-cursor" aria-hidden />}
          </div>
          {citedRecords.length > 0 && (
            <div
              style={{
                marginTop: "0.75rem",
                paddingTop: "0.75rem",
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <div style={{ fontSize: "0.8125rem", color: "#64748b", marginBottom: "0.35rem" }}>
                Sources
              </div>
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
