"use client";

import { useActionState } from "react";

type Field = {
  id: string;
  name: string;
  slug: string;
  fieldType: string;
  isRequired: boolean;
  settings: unknown;
};

export function PublicForm({
  moduleName,
  fields,
  action,
}: {
  tenantSlug: string;
  segment: string;
  moduleName: string;
  fields: Field[];
  action: (prev: unknown, formData: FormData) => Promise<unknown>;
}) {
  const [state, formAction] = useActionState(action, null);

  return (
    <form action={formAction} className="site-public-form">
      {fields.map((field) => (
        <div key={field.id} className="form-group">
          <label htmlFor={field.slug}>
            {field.name}
            {field.isRequired && " *"}
          </label>
          <PublicFieldInput field={field} />
        </div>
      ))}
      {(() => {
        const err = state && typeof state === "object" && "error" in state ? (state as { error: string }).error : null;
        return err ? <p className="view-error" role="alert">{err}</p> : null;
      })()}
      <button type="submit" className="btn btn-primary">
        Submit
      </button>
    </form>
  );
}

function PublicFieldInput({ field }: { field: Field }) {
  const id = field.slug;
  const settings = (field.settings as Record<string, unknown>) ?? {};
  const options = (settings.options as string[]) ?? [];

  switch (field.fieldType) {
    case "boolean":
      return (
        <select id={id} name={field.slug} defaultValue="false">
          <option value="false">No</option>
          <option value="true">Yes</option>
        </select>
      );
    case "number":
      return (
        <input
          type="number"
          id={id}
          name={field.slug}
          required={field.isRequired}
        />
      );
    case "date":
      return (
        <input
          type="date"
          id={id}
          name={field.slug}
          required={field.isRequired}
        />
      );
    case "select":
      return (
        <select id={id} name={field.slug} required={field.isRequired}>
          <option value="">Select...</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    case "json":
      return (
        <textarea
          id={id}
          name={field.slug}
          required={field.isRequired}
          rows={4}
        />
      );
    case "relation":
      return null;
    case "text":
    default:
      return (
        <input
          type="text"
          id={id}
          name={field.slug}
          required={field.isRequired}
        />
      );
  }
}
