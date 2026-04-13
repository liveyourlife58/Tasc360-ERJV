/**
 * Field.settings.showInEntityList — when explicitly false, the field is omitted from
 * the module record list table and CSV export columns (entity detail form is unchanged).
 */

export function isFieldShownInEntityList(settings: unknown): boolean {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return true;
  const v = (settings as Record<string, unknown>).showInEntityList;
  if (v === false) return false;
  return true;
}

export function fieldSlugsShownInEntityList(fields: { slug: string; settings: unknown }[]): string[] {
  return fields.filter((f) => isFieldShownInEntityList(f.settings)).map((f) => f.slug);
}
