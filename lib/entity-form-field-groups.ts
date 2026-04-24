/** Minimal field shape for grouping (matches EntityForm `Field`). */
export type EntityFormGroupableField = { id: string; fieldType: string };

/** Field types that should span all columns in the entity form grid. */
export const ENTITY_FORM_FULL_WIDTH_FIELD_TYPES = new Set([
  "activity",
  "relation-multi",
  "file",
  "json",
]);

const CATEGORY_ORDER = [
  "text",
  "numbers",
  "dates",
  "choices",
  "references",
  "files",
  "structured",
  "activity",
] as const;

type FieldCategory = (typeof CATEGORY_ORDER)[number];

const CATEGORY_LABELS: Record<FieldCategory, string> = {
  text: "Text & names",
  numbers: "Numbers",
  dates: "Dates",
  choices: "Choices",
  references: "References & people",
  files: "Files",
  structured: "Structured data",
  activity: "Activity",
};

function fieldCategory(fieldType: string): FieldCategory {
  switch (fieldType) {
    case "number":
      return "numbers";
    case "date":
    case "datetime":
      return "dates";
    case "boolean":
    case "select":
      return "choices";
    case "relation":
    case "relation-multi":
    case "tenant-user":
      return "references";
    case "file":
      return "files";
    case "json":
      return "structured";
    case "activity":
      return "activity";
    case "text":
    default:
      return "text";
  }
}

export function groupEntityFormFields<T extends EntityFormGroupableField>(
  fields: T[]
): { key: FieldCategory; title: string; fields: T[] }[] {
  const buckets = new Map<FieldCategory, T[]>();
  for (const key of CATEGORY_ORDER) {
    buckets.set(key, []);
  }
  for (const f of fields) {
    const cat = fieldCategory(f.fieldType);
    buckets.get(cat)!.push(f);
  }
  return CATEGORY_ORDER.filter((key) => (buckets.get(key) ?? []).length > 0).map((key) => ({
    key,
    title: CATEGORY_LABELS[key],
    fields: buckets.get(key)!,
  }));
}

export function entityFormFieldCellClassName(fieldType: string): string {
  const base = "entity-form-field-cell";
  if (ENTITY_FORM_FULL_WIDTH_FIELD_TYPES.has(fieldType)) return `${base} entity-form-field-cell--full`;
  return base;
}
