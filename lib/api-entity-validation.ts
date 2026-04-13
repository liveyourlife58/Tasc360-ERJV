/**
 * Validate entity data against module field definitions for API POST/PATCH.
 */

type FieldLike = { slug: string; fieldType: string; isRequired: boolean; settings?: unknown };

function isPresent(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
}

function typeMatches(fieldType: string, value: unknown, _settings?: unknown): boolean {
  switch (fieldType) {
    case "text":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && !Number.isNaN(value);
    case "date":
      return typeof value === "string"; // ISO date or datetime string
    case "boolean":
      return typeof value === "boolean";
    case "select":
    case "tenant-user":
      return typeof value === "string";
    case "relation":
    case "file":
      return typeof value === "string" || value === null;
    case "relation-multi":
      return Array.isArray(value) && value.every((x) => typeof x === "string");
    case "json":
      return value === null || typeof value === "object" || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
    default:
      return true;
  }
}

export type ValidateEntityDataOptions = { partial: boolean };

export type ValidateEntityDataResult = { valid: true } | { valid: false; message: string };

/**
 * Validate data against module fields. Use partial: false for POST (create), partial: true for PATCH.
 */
export function validateEntityData(
  fields: FieldLike[],
  data: Record<string, unknown>,
  options: { partial: boolean }
): ValidateEntityDataResult {
  const { partial } = options;
  for (const field of fields) {
    if (field.fieldType === "activity") continue;
    const value = data[field.slug];
    const provided = Object.prototype.hasOwnProperty.call(data, field.slug);
    if (!partial && field.isRequired && (!provided || !isPresent(value))) {
      return { valid: false, message: `Field "${field.slug}" is required.` };
    }
    if (provided && isPresent(value) && !typeMatches(field.fieldType, value, field.settings)) {
      return { valid: false, message: `Field "${field.slug}" must be of type ${field.fieldType}.` };
    }
  }
  return { valid: true };
}
