/** Which target-module field slug to use as the human-readable label for relation UI and tables. */
export function resolveRelationDisplayFieldSlug(
  settings: Record<string, unknown> | undefined | null,
  targetModuleFields: { slug: string }[]
): string {
  const explicit = settings?.displayFieldSlug as string | undefined;
  if (explicit && targetModuleFields.some((f) => f.slug === explicit)) return explicit;
  const nameField = targetModuleFields.find((f) => f.slug === "name");
  if (nameField) return nameField.slug;
  return targetModuleFields[0]?.slug ?? "name";
}

export function labelFromTargetEntityData(
  data: Record<string, unknown>,
  displaySlug: string,
  entityId: string
): string {
  const raw = data[displaySlug];
  const s = raw != null && raw !== "" ? String(raw).trim() : "";
  if (s) return s;
  const name = String(data.name ?? "").trim();
  if (name) return name;
  const title = String(data.title ?? "").trim();
  if (title) return title;
  return entityId.slice(0, 8);
}
