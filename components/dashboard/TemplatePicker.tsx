"use client";

import { useFormStatus } from "react-dom";
import { TEMPLATES } from "@/lib/templates";
import { applyTemplate } from "@/app/dashboard/actions";

function TemplateCardButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary template-card-btn" disabled={pending}>
      {pending ? "Creating…" : "Use this template"}
    </button>
  );
}

export function TemplatePicker() {
  return (
    <section className="template-picker" aria-label="Start from template">
      <h2 className="template-picker-title">Start from a template</h2>
      <p className="template-picker-description">
        Get started quickly with pre-built modules and views for your industry.
      </p>
      <div className="template-cards">
        {TEMPLATES.map((t) => (
          <form key={t.id} action={async (_formData: FormData): Promise<void> => { await applyTemplate(t.id); }} className="template-card">
            <h3 className="template-card-name">{t.name}</h3>
            <p className="template-card-description">{t.description}</p>
            <p className="template-card-modules">
              {t.modules.length} module{t.modules.length !== 1 ? "s" : ""}: {t.modules.map((m) => m.name).join(", ")}
            </p>
            <TemplateCardButton />
          </form>
        ))}
      </div>
    </section>
  );
}
