/**
 * Dashboard AI: suggest module and view from natural language.
 * Requires OPENAI_API_KEY; all suggestions use the OpenAI API.
 */

const ALLOWED_FIELD_TYPES = ["text", "number", "date", "boolean", "select", "json", "relation", "relation-multi", "file"] as const;

export type SuggestedField = {
  name: string;
  slug: string;
  fieldType: (typeof ALLOWED_FIELD_TYPES)[number];
  isRequired?: boolean;
  settings?: { options?: string[]; targetModuleSlug?: string };
};

export type SuggestedModule = {
  name: string;
  slug: string;
  description?: string;
  fields: SuggestedField[];
};

export type SuggestedView = {
  name: string;
  viewType?: "list" | "board" | "calendar";
  filter: { field: string; op: string; value: unknown }[];
  sort: { field: string; dir: "asc" | "desc" }[];
  columns: string[];
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Normalize display names to Title Case so labels are consistent (e.g. "email" -> "Email", "first name" -> "First Name"). */
function toTitleCase(s: string): string {
  if (!s || typeof s !== "string") return s;
  return s.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Call OpenAI to suggest module (JSON). */
async function openaiSuggestModule(
  prompt: string,
  existingSlugs: string[]
): Promise<SuggestedModule | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const { OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey });
  const sys = `You are an assistant that suggests a single database module (like a table) from a short user description.
Return valid JSON only, no markdown, with this shape:
{ "name": "Human Name", "slug": "snake_slug", "description": "optional", "fields": [ { "name": "Field Name", "slug": "snake_slug", "fieldType": "text"|"number"|"date"|"boolean"|"select"|"json"|"relation"|"relation-multi"|"file", "isRequired": boolean, "settings": {} or { "options": ["a","b"] } for select, or { "targetModuleSlug": "other_module_slug" } for relation/relation-multi } ] }
Slug must be unique. Existing slugs: ${existingSlugs.join(", ")}. Field types: text, number, date, boolean, select, json, relation (single link to another module), relation-multi (multiple links; use for "assign multiple X to this record", e.g. customers on a group), file (attachment).
Include every field the user asks for. Use "date" for dates, "text" for location/description/name, "number" for counts, "relation" for a single link to another module, "relation-multi" when the user wants to assign multiple records from another module (e.g. "multiple customers", "list of contacts").`;
  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });
    const raw = res.choices[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SuggestedModule;
    if (!parsed.name || !parsed.slug || !Array.isArray(parsed.fields)) return null;
    const slug = slugify(parsed.slug);
    const fields = (parsed.fields as SuggestedField[]).map((f) => ({
      ...f,
      name: toTitleCase(f.name ?? ""),
      slug: slugify(f.slug || f.name),
      fieldType: ALLOWED_FIELD_TYPES.includes(f.fieldType as (typeof ALLOWED_FIELD_TYPES)[number])
        ? f.fieldType
        : "text",
    }));
    return {
      ...parsed,
      name: toTitleCase(parsed.name),
      slug: existingSlugs.includes(slug) ? `${slug}_${Date.now().toString(36)}` : slug,
      fields,
    };
  } catch {
    return null;
  }
}

/** Call OpenAI to suggest view. */
async function openaiSuggestView(
  prompt: string,
  moduleName: string,
  fieldSlugs: string[]
): Promise<SuggestedView | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const { OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey });
  const sys = `You suggest a saved view from a short user description.
Return valid JSON only: { "name": "View name", "viewType": "list"|"board"|"calendar", "filter": [ { "field": "field_slug", "op": "eq"|"neq"|"contains"|"gt"|"lt"|"gte"|"lte"|"empty", "value": value } ], "sort": [ { "field": "field_slug or createdAt", "dir": "asc"|"desc" } ], "columns": ["field_slug", ...] }
viewType: list|board|calendar. filter op: eq, neq, contains, gt, lt, gte, lte, empty. Module: ${moduleName}. Allowed field slugs: ${fieldSlugs.join(", ")}, and createdAt.`;
  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });
    const raw = res.choices[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SuggestedView;
    if (!parsed.name || !Array.isArray(parsed.filter) || !Array.isArray(parsed.sort) || !Array.isArray(parsed.columns))
      return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function suggestModuleFromPrompt(
  prompt: string,
  existingModuleSlugs: string[]
): Promise<SuggestedModule> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("OPENAI_API_KEY is not set. Add it to your environment to use AI suggestions.");
  }
  const ai = await openaiSuggestModule(prompt, existingModuleSlugs);
  if (!ai) {
    throw new Error("Could not generate module suggestion. Please check your connection and try again.");
  }
  return ai;
}

export async function suggestViewFromPrompt(
  prompt: string,
  moduleName: string,
  fieldSlugs: string[]
): Promise<SuggestedView> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("OPENAI_API_KEY is not set. Add it to your environment to use AI suggestions.");
  }
  const ai = await openaiSuggestView(prompt, moduleName, fieldSlugs);
  if (!ai) {
    throw new Error("Could not generate view suggestion. Please try again.");
  }
  return ai;
}

// -----------------------------------------------------------------------------
// Unified dashboard intent: one prompt → create_module | add_fields | create_view
// -----------------------------------------------------------------------------

export type ModuleContext = {
  slug: string;
  name: string;
  fieldSlugs: string[];
  views?: { id: string; name: string }[];
  isActive?: boolean;
};

export type DashboardIntent =
  | { intent: "create_module"; payload: SuggestedModule }
  | { intent: "add_fields"; payload: { moduleSlug: string; fields: SuggestedField[] } }
  | { intent: "create_view"; payload: { moduleSlug: string; view: SuggestedView } }
  | { intent: "enable_public_module"; payload: { moduleSlug: string } }
  | { intent: "disable_public_module"; payload: { moduleSlug: string } }
  | { intent: "set_default_home"; payload: { type: "module"; moduleSlug: string } | { type: "view"; moduleSlug: string; viewId?: string; viewName?: string } }
  | { intent: "create_entity"; payload: { moduleSlug: string; data: Record<string, unknown> } }
  | { intent: "create_entities"; payload: { moduleSlug: string; data: Record<string, unknown>[] } }
  | { intent: "update_view"; payload: { moduleSlug: string; viewId?: string; viewName?: string; view: Partial<SuggestedView> } }
  | { intent: "delete_view"; payload: { moduleSlug: string; viewId?: string; viewName?: string } }
  | { intent: "rename_module"; payload: { moduleSlug: string; name?: string; description?: string } }
  | { intent: "remove_field"; payload: { moduleSlug: string; fieldSlug: string } }
  | { intent: "reorder_modules"; payload: { moduleSlugs: string[] } }
  | { intent: "delete_module"; payload: { moduleSlug: string } }
  | { intent: "delete_entity"; payload: { moduleSlug: string; entityRef: string } }
  | { intent: "update_entity"; payload: { moduleSlug: string; entityRef: string; data: Record<string, unknown> } }
  | { intent: "restore_entity"; payload: { moduleSlug: string; entityRef: string } }
  | { intent: "duplicate_entity"; payload: { moduleSlug: string; entityRef: string; data?: Record<string, unknown> } }
  | { intent: "create_relationship"; payload: { sourceModuleSlug: string; sourceEntityRef: string; targetModuleSlug: string; targetEntityRef: string; relationType: string } }
  | { intent: "delete_relationship"; payload: { sourceModuleSlug: string; sourceEntityRef: string; targetModuleSlug: string; targetEntityRef: string; relationType?: string } }
  | { intent: "add_tag_entity"; payload: { moduleSlug: string; entityRef: string; tag: string } }
  | { intent: "remove_tag_entity"; payload: { moduleSlug: string; entityRef: string; tag: string } }
  | { intent: "bulk_update_entities"; payload: { moduleSlug: string; filter: { field: string; op: string; value: unknown }[]; data: Record<string, unknown> } }
  | { intent: "bulk_delete_entities"; payload: { moduleSlug: string; filter: { field: string; op: string; value: unknown }[] } }
  | { intent: "disable_module"; payload: { moduleSlug: string } }
  | { intent: "enable_module"; payload: { moduleSlug: string } }
  | { intent: "reorder_fields"; payload: { moduleSlug: string; fieldSlug: string; beforeFieldSlug?: string; afterFieldSlug?: string } }
  | { intent: "similar_module_exists"; payload: { suggestedSlug: string; suggestedName: string; existing: { slug: string; name: string } } };

const INTENT_LIST = `
1) create_module - payload: { name, slug, description?, fields: [ { name, slug, fieldType, isRequired?, settings? } ] }. fieldType: text|number|date|boolean|select|json|relation|relation-multi|file. Use relation-multi for "assign multiple X" (e.g. multiple customers per group); settings: { targetModuleSlug: "other_module_slug" }.
2) add_fields - payload: { moduleSlug, fields: [ same ] }. Use exact module slug.
3) create_view - payload: { moduleSlug, view: { name, viewType?: "list"|"board"|"calendar", filter: [], sort: [ { field, dir } ], columns: [] } }. viewType defaults to list. filter op: eq|neq|contains|gt|lt|gte|lte|empty.
4) enable_public_module - payload: { moduleSlug }. Show this module on the public/customer site.
4b) disable_public_module - payload: { moduleSlug }. Remove this module from the public/customer site. "Remove Events from public site", "hide X on customer site".
5) set_default_home - payload: { type: "module", moduleSlug } or { type: "view", moduleSlug, viewId? or viewName? }. Set dashboard home.
6) create_entity - payload: { moduleSlug, data: { <fieldSlug>: value } }. ADD ONE RECORD. "Create an event", "add an event called X on date at Y" -> create_entity. moduleSlug = module slug (e.g. events). data keys = exact field slugs (name, date, location). Values: string, number, or ISO date YYYY-MM-DD (e.g. "Mar 9th" -> "2025-03-09").
6b) create_entities - payload: { moduleSlug, data: [ { <fieldSlug>: value }, ... ] }. ADD MULTIPLE RECORDS. Use when user asks for two or more events/records in one prompt. Examples: "create two events, one called X and the other called Y" -> { "intent": "create_entities", "payload": { "moduleSlug": "events", "data": [ { "name": "X" }, { "name": "Y" } ] } }; "Create two events, One called fly fishing, and the other called ballroom dancing" -> create_entities, moduleSlug "events", data: [ { "name": "fly fishing" }, { "name": "ballroom dancing" } ]. Include only fields the user provides (name-only is fine). data MUST be an array of objects.
7) update_view - payload: { moduleSlug, viewId? or viewName?, view: { name?, viewType?, filter?, sort?, columns? } }. Update existing view. viewType: list|board|calendar.
8) delete_view - payload: { moduleSlug, viewId? or viewName? }
9) rename_module - payload: { moduleSlug, name?, description? }
10) remove_field - payload: { moduleSlug, fieldSlug }
11) reorder_modules - payload: { moduleSlugs: string[] }. New order of module slugs.
12) delete_module - payload: { moduleSlug }. Permanently delete this module and its fields (entities unlinked).
13) delete_entity - payload: { moduleSlug, entityRef }. Soft-delete one record. entityRef = phrase to match (e.g. "hockey fundraiser", "March 9 event").
14) update_entity - payload: { moduleSlug, entityRef, data: { <fieldSlug>: value } }. Update one record. "Change hockey fundraiser date to March 10", "update event X location to Y". data = only fields to change; use exact field slugs.
15) restore_entity - payload: { moduleSlug, entityRef }. Restore a soft-deleted record. "Restore the hockey fundraiser event", "undo delete for X".
16) duplicate_entity - payload: { moduleSlug, entityRef, data? }. Duplicate/copy one record. data = optional overrides. "Duplicate the hockey fundraiser event", "copy event X".
17) create_relationship - payload: { sourceModuleSlug, sourceEntityRef, targetModuleSlug, targetEntityRef, relationType }. Link two records. "Link customer Acme to job 123", "connect invoice X to order Y". relationType = short label (e.g. "customer", "invoice").
17b) delete_relationship - payload: { sourceModuleSlug, sourceEntityRef, targetModuleSlug, targetEntityRef, relationType? }. Unlink two records. "Unlink customer Acme from job 123", "remove link between X and Y". relationType optional to match specific link type.
18) add_tag_entity - payload: { moduleSlug, entityRef, tag }. Add a tag to one record. "Tag hockey fundraiser as featured", "add tag urgent to event X". tag = single word or slug.
19) remove_tag_entity - payload: { moduleSlug, entityRef, tag }. Remove a tag from one record.
20) bulk_update_entities - payload: { moduleSlug, filter: [ { field, op, value } ], data: { <fieldSlug>: value } }. Update all records matching filter. filter op: eq|neq|contains|gt|lt|gte|lte|empty. "Set all March events to location TBD".
20b) bulk_delete_entities - payload: { moduleSlug, filter: [ { field, op, value } ] }. Soft-delete all records matching filter. Same filter ops as bulk_update. "Delete all test events", "remove all March events".
21) disable_module - payload: { moduleSlug }. Hide module from dashboard (set isActive false). "Disable module X", "hide Events module".
22) enable_module - payload: { moduleSlug }. Show module in dashboard again (set isActive true). "Enable module X", "show Events module again".
23) reorder_fields - payload: { moduleSlug, fieldSlug, beforeFieldSlug? or afterFieldSlug? }. Move a field before or after another. E.g. "move description before date on Events" -> fieldSlug: description, beforeFieldSlug: date, moduleSlug: events.`;

function normalizeEntityData(
  mod: ModuleContext,
  rawData: Record<string, unknown>
): Record<string, unknown> | null {
  const fieldSlugs = mod.fieldSlugs.filter((s) => s !== "createdAt");
  const data: Record<string, unknown> = {};
  for (const key of Object.keys(rawData)) {
    const slug = slugify(key);
    if (fieldSlugs.includes(slug)) data[slug] = rawData[key];
  }
  if (Object.keys(data).length === 0) {
    const aliasToSlug: Record<string, string> = {};
    for (const f of fieldSlugs) aliasToSlug[f] = f;
    const common: Record<string, string[]> = { name: ["title", "eventname", "event_name"], date: ["eventdate", "event_date", "when"], location: ["venue", "place", "where", "address"] };
    for (const [slug, aliases] of Object.entries(common)) {
      if (!fieldSlugs.includes(slug)) continue;
      for (const a of aliases) aliasToSlug[a] = slug;
    }
    for (const key of Object.keys(rawData)) {
      const slug = aliasToSlug[slugify(key)];
      if (slug && !(slug in data)) data[slug] = rawData[key];
    }
  }
  return Object.keys(data).length > 0 ? data : null;
}

async function openaiParseDashboardIntent(
  prompt: string,
  existingModules: ModuleContext[],
  existingSlugs: string[]
): Promise<DashboardIntent | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const { OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey });
  const modulesJson = JSON.stringify(
    existingModules.map((m) => ({ slug: m.slug, name: m.name, fieldSlugs: m.fieldSlugs, views: m.views }))
  );
  const sys = `You are an assistant for a multi-tenant app. The user can ask for any of these. Return valid JSON only, no markdown. One intent. Slugs snake_case.
Rule: Adding records to the existing Events (or similar) module = create_entity (one) or create_entities (two or more). "Create two events", "add two events", "one called X and the other called Y" = create_entities. Do NOT use create_module for adding records; create_module is only for creating a brand-new table/module type.
Existing modules (with fieldSlugs and views): ${modulesJson}
Intents: ${INTENT_LIST}`;
  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });
    const raw = res.choices[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardIntent;

    if (parsed.intent === "create_module" && parsed.payload && "fields" in parsed.payload) {
      const p = parsed.payload as SuggestedModule;
      const slug = slugify(p.slug);
      const fields = (p.fields as SuggestedField[]).map((f) => ({
        ...f,
        name: toTitleCase(f.name ?? ""),
        slug: slugify(f.slug || f.name),
        fieldType: ALLOWED_FIELD_TYPES.includes(f.fieldType as (typeof ALLOWED_FIELD_TYPES)[number])
          ? f.fieldType
          : "text",
      }));
      return {
        intent: "create_module",
        payload: {
          ...p,
          name: toTitleCase(p.name ?? ""),
          slug: existingSlugs.includes(slug) ? `${slug}_${Date.now().toString(36)}` : slug,
          fields,
        },
      };
    }
    if (parsed.intent === "add_fields" && parsed.payload && "moduleSlug" in parsed.payload && "fields" in parsed.payload) {
      const p = parsed.payload as { moduleSlug: string; fields: SuggestedField[] };
      const mod = existingModules.find((m) => m.slug === p.moduleSlug);
      if (!mod) return null;
      const fields = p.fields.map((f) => ({
        ...f,
        name: toTitleCase(f.name ?? ""),
        slug: slugify(f.slug || f.name),
        fieldType: ALLOWED_FIELD_TYPES.includes(f.fieldType as (typeof ALLOWED_FIELD_TYPES)[number])
          ? f.fieldType
          : "text",
      }));
      return { intent: "add_fields", payload: { moduleSlug: p.moduleSlug, fields } };
    }
    if (parsed.intent === "create_view" && parsed.payload && "moduleSlug" in parsed.payload && "view" in parsed.payload) {
      const p = parsed.payload as { moduleSlug: string; view: SuggestedView };
      const mod = existingModules.find((m) => m.slug === p.moduleSlug);
      if (!mod) return null;
      const view = p.view;
      const columns = (view.columns || []).filter((c) => mod.fieldSlugs.includes(c) || c === "createdAt");
      const viewType = view.viewType === "board" || view.viewType === "calendar" ? view.viewType : "list";
      return {
        intent: "create_view",
        payload: { moduleSlug: p.moduleSlug, view: { ...view, viewType, columns: columns.length ? columns : mod.fieldSlugs.slice(0, 6) } },
      };
    }
    if (parsed.intent === "enable_public_module" && parsed.payload && "moduleSlug" in parsed.payload) {
      const p = parsed.payload as { moduleSlug: string };
      if (existingModules.some((m) => m.slug === p.moduleSlug))
        return { intent: "enable_public_module", payload: { moduleSlug: p.moduleSlug } };
    }
    if (parsed.intent === "set_default_home" && parsed.payload && "type" in parsed.payload && "moduleSlug" in parsed.payload) {
      const p = parsed.payload as { type: "module"; moduleSlug: string } | { type: "view"; moduleSlug: string; viewId?: string; viewName?: string };
      if (existingModules.some((m) => m.slug === p.moduleSlug)) return { intent: "set_default_home", payload: p };
    }
    if (parsed.intent === "create_entity" && parsed.payload && "moduleSlug" in parsed.payload && "data" in parsed.payload) {
      const p = parsed.payload as { moduleSlug: string; data: Record<string, unknown> };
      const normalizedSlug = slugify(p.moduleSlug);
      const mod = existingModules.find((m) => m.slug === normalizedSlug || m.slug === p.moduleSlug);
      if (!mod || typeof p.data !== "object" || p.data === null) return null;
      const data = normalizeEntityData(mod, p.data);
      if (data) return { intent: "create_entity", payload: { moduleSlug: mod.slug, data } };
    }
    if (parsed.intent === "create_entities" && parsed.payload && "moduleSlug" in parsed.payload) {
      const p = parsed.payload as { moduleSlug: string; data?: unknown; items?: unknown };
      const rawData = p.data ?? p.items;
      if (rawData === undefined) return null;
      const normalizedSlug = slugify(p.moduleSlug);
      const mod = existingModules.find((m) => m.slug === normalizedSlug || m.slug === p.moduleSlug);
      if (!mod) return null;
      const rawList = Array.isArray(rawData)
        ? rawData
        : typeof rawData === "object" && rawData !== null
          ? [rawData]
          : [];
      const list: Record<string, unknown>[] = [];
      for (const item of rawList) {
        if (typeof item === "object" && item !== null) {
          const normalized = normalizeEntityData(mod, item as Record<string, unknown>);
          if (normalized) list.push(normalized);
        }
      }
      if (list.length > 0)
        return { intent: "create_entities", payload: { moduleSlug: mod.slug, data: list } };
    }
    if (parsed.intent === "update_view" && parsed.payload && "moduleSlug" in parsed.payload && "view" in parsed.payload) {
      const p = parsed.payload as { moduleSlug: string; viewId?: string; viewName?: string; view: Partial<SuggestedView> };
      if (existingModules.some((m) => m.slug === p.moduleSlug))
        return { intent: "update_view", payload: p };
    }
    if (parsed.intent === "delete_view" && parsed.payload && "moduleSlug" in parsed.payload) {
      const p = parsed.payload as { moduleSlug: string; viewId?: string; viewName?: string };
      if (existingModules.some((m) => m.slug === p.moduleSlug))
        return { intent: "delete_view", payload: p };
    }
    if (parsed.intent === "rename_module" && parsed.payload && "moduleSlug" in parsed.payload) {
      const p = parsed.payload as { moduleSlug: string; name?: string; description?: string };
      if (existingModules.some((m) => m.slug === p.moduleSlug))
        return { intent: "rename_module", payload: p };
    }
    if (parsed.intent === "remove_field" && parsed.payload && "moduleSlug" in parsed.payload && "fieldSlug" in parsed.payload) {
      const p = parsed.payload as { moduleSlug: string; fieldSlug: string };
      const mod = existingModules.find((m) => m.slug === p.moduleSlug);
      if (mod?.fieldSlugs.includes(p.fieldSlug))
        return { intent: "remove_field", payload: { moduleSlug: p.moduleSlug, fieldSlug: p.fieldSlug } };
    }
    if (parsed.intent === "reorder_modules" && parsed.payload && "moduleSlugs" in parsed.payload) {
      const p = parsed.payload as { moduleSlugs: string[] };
      if (Array.isArray(p.moduleSlugs) && p.moduleSlugs.every((s) => existingSlugs.includes(s)))
        return { intent: "reorder_modules", payload: { moduleSlugs: p.moduleSlugs } };
    }
    if (parsed.intent === "delete_module" && parsed.payload && "moduleSlug" in parsed.payload) {
      const p = parsed.payload as { moduleSlug: string };
      if (existingModules.some((m) => m.slug === p.moduleSlug))
        return { intent: "delete_module", payload: { moduleSlug: p.moduleSlug } };
    }
    if (parsed.intent === "delete_entity" && parsed.payload && "moduleSlug" in parsed.payload && "entityRef" in parsed.payload) {
      const p = parsed.payload as { moduleSlug: string; entityRef: string };
      if (existingModules.some((m) => m.slug === p.moduleSlug) && typeof p.entityRef === "string" && p.entityRef.trim())
        return { intent: "delete_entity", payload: { moduleSlug: p.moduleSlug, entityRef: p.entityRef.trim() } };
    }
    if (parsed.intent === "reorder_fields" && parsed.payload && "moduleSlug" in parsed.payload && "fieldSlug" in parsed.payload) {
      const p = parsed.payload as { moduleSlug: string; fieldSlug: string; beforeFieldSlug?: string; afterFieldSlug?: string };
      const mod = existingModules.find((m) => m.slug === p.moduleSlug);
      if (!mod || !mod.fieldSlugs.includes(p.fieldSlug)) return null;
      if (p.beforeFieldSlug && mod.fieldSlugs.includes(p.beforeFieldSlug) && p.fieldSlug !== p.beforeFieldSlug)
        return { intent: "reorder_fields", payload: { moduleSlug: p.moduleSlug, fieldSlug: p.fieldSlug, beforeFieldSlug: p.beforeFieldSlug } };
      if (p.afterFieldSlug && mod.fieldSlugs.includes(p.afterFieldSlug) && p.fieldSlug !== p.afterFieldSlug)
        return { intent: "reorder_fields", payload: { moduleSlug: p.moduleSlug, fieldSlug: p.fieldSlug, afterFieldSlug: p.afterFieldSlug } };
    }
    if (parsed.intent === "update_entity" && parsed.payload && "moduleSlug" in parsed.payload && "entityRef" in parsed.payload && "data" in parsed.payload) {
      const p = parsed.payload as { moduleSlug: string; entityRef: string; data: Record<string, unknown> };
      const mod = existingModules.find((m) => m.slug === slugify(p.moduleSlug) || m.slug === p.moduleSlug);
      if (!mod || typeof p.entityRef !== "string" || !p.entityRef.trim() || typeof p.data !== "object" || !p.data) return null;
      const data = normalizeEntityData(mod, p.data);
      if (data && Object.keys(data).length > 0)
        return { intent: "update_entity", payload: { moduleSlug: mod.slug, entityRef: p.entityRef.trim(), data } };
    }
    if (parsed.intent === "restore_entity" && parsed.payload && "moduleSlug" in parsed.payload && "entityRef" in parsed.payload) {
      const p = parsed.payload as { moduleSlug: string; entityRef: string };
      const mod = existingModules.find((m) => m.slug === slugify(p.moduleSlug) || m.slug === p.moduleSlug);
      if (mod && typeof p.entityRef === "string" && p.entityRef.trim())
        return { intent: "restore_entity", payload: { moduleSlug: mod.slug, entityRef: p.entityRef.trim() } };
    }
    if (parsed.intent === "duplicate_entity" && parsed.payload && "moduleSlug" in parsed.payload && "entityRef" in parsed.payload) {
      const p = parsed.payload as { moduleSlug: string; entityRef: string; data?: Record<string, unknown> };
      const mod = existingModules.find((m) => m.slug === slugify(p.moduleSlug) || m.slug === p.moduleSlug);
      if (!mod || typeof p.entityRef !== "string" || !p.entityRef.trim()) return null;
      const overrides = p.data && typeof p.data === "object" ? normalizeEntityData(mod, p.data) ?? {} : {};
      return { intent: "duplicate_entity", payload: { moduleSlug: mod.slug, entityRef: p.entityRef.trim(), data: overrides } };
    }
    if (parsed.intent === "create_relationship" && parsed.payload && "sourceModuleSlug" in parsed.payload && "sourceEntityRef" in parsed.payload && "targetModuleSlug" in parsed.payload && "targetEntityRef" in parsed.payload && "relationType" in parsed.payload) {
      const p = parsed.payload as { sourceModuleSlug: string; sourceEntityRef: string; targetModuleSlug: string; targetEntityRef: string; relationType: string };
      const srcMod = existingModules.find((m) => m.slug === slugify(p.sourceModuleSlug) || m.slug === p.sourceModuleSlug);
      const tgtMod = existingModules.find((m) => m.slug === slugify(p.targetModuleSlug) || m.slug === p.targetModuleSlug);
      if (srcMod && tgtMod && typeof p.relationType === "string" && p.relationType.trim())
        return { intent: "create_relationship", payload: { sourceModuleSlug: srcMod.slug, sourceEntityRef: p.sourceEntityRef.trim(), targetModuleSlug: tgtMod.slug, targetEntityRef: p.targetEntityRef.trim(), relationType: slugify(p.relationType) || "link" } };
    }
    if (parsed.intent === "add_tag_entity" && parsed.payload && "moduleSlug" in parsed.payload && "entityRef" in parsed.payload && "tag" in parsed.payload) {
      const p = parsed.payload as { moduleSlug: string; entityRef: string; tag: string };
      const mod = existingModules.find((m) => m.slug === slugify(p.moduleSlug) || m.slug === p.moduleSlug);
      if (mod && typeof p.entityRef === "string" && p.entityRef.trim() && typeof p.tag === "string" && p.tag.trim())
        return { intent: "add_tag_entity", payload: { moduleSlug: mod.slug, entityRef: p.entityRef.trim(), tag: slugify(p.tag) || p.tag.trim().toLowerCase().replace(/\s+/g, "_") } };
    }
    if (parsed.intent === "remove_tag_entity" && parsed.payload && "moduleSlug" in parsed.payload && "entityRef" in parsed.payload && "tag" in parsed.payload) {
      const p = parsed.payload as { moduleSlug: string; entityRef: string; tag: string };
      const mod = existingModules.find((m) => m.slug === slugify(p.moduleSlug) || m.slug === p.moduleSlug);
      if (mod && typeof p.entityRef === "string" && p.entityRef.trim() && typeof p.tag === "string" && p.tag.trim())
        return { intent: "remove_tag_entity", payload: { moduleSlug: mod.slug, entityRef: p.entityRef.trim(), tag: slugify(p.tag) || p.tag.trim().toLowerCase().replace(/\s+/g, "_") } };
    }
    if (parsed.intent === "bulk_update_entities" && parsed.payload && "moduleSlug" in parsed.payload && "filter" in parsed.payload && "data" in parsed.payload) {
      const p = parsed.payload as { moduleSlug: string; filter: { field: string; op: string; value: unknown }[]; data: Record<string, unknown> };
      const mod = existingModules.find((m) => m.slug === slugify(p.moduleSlug) || m.slug === p.moduleSlug);
      if (!mod || !Array.isArray(p.filter) || typeof p.data !== "object" || p.data === null) return null;
      const data = normalizeEntityData(mod, p.data);
      if (data && Object.keys(data).length > 0)
        return { intent: "bulk_update_entities", payload: { moduleSlug: mod.slug, filter: p.filter, data } };
    }
    if (parsed.intent === "bulk_delete_entities" && parsed.payload && "moduleSlug" in parsed.payload && "filter" in parsed.payload) {
      const p = parsed.payload as { moduleSlug: string; filter: { field: string; op: string; value: unknown }[] };
      const mod = existingModules.find((m) => m.slug === slugify(p.moduleSlug) || m.slug === p.moduleSlug);
      if (mod && Array.isArray(p.filter))
        return { intent: "bulk_delete_entities", payload: { moduleSlug: mod.slug, filter: p.filter } };
    }
    if (parsed.intent === "disable_public_module" && parsed.payload && "moduleSlug" in parsed.payload) {
      const p = parsed.payload as { moduleSlug: string };
      const mod = existingModules.find((m) => m.slug === slugify(p.moduleSlug) || m.slug === p.moduleSlug);
      if (mod) return { intent: "disable_public_module", payload: { moduleSlug: mod.slug } };
    }
    if (parsed.intent === "delete_relationship" && parsed.payload && "sourceModuleSlug" in parsed.payload && "sourceEntityRef" in parsed.payload && "targetModuleSlug" in parsed.payload && "targetEntityRef" in parsed.payload) {
      const p = parsed.payload as { sourceModuleSlug: string; sourceEntityRef: string; targetModuleSlug: string; targetEntityRef: string; relationType?: string };
      const srcMod = existingModules.find((m) => m.slug === slugify(p.sourceModuleSlug) || m.slug === p.sourceModuleSlug);
      const tgtMod = existingModules.find((m) => m.slug === slugify(p.targetModuleSlug) || m.slug === p.targetModuleSlug);
      if (srcMod && tgtMod)
        return { intent: "delete_relationship", payload: { sourceModuleSlug: srcMod.slug, sourceEntityRef: p.sourceEntityRef.trim(), targetModuleSlug: tgtMod.slug, targetEntityRef: p.targetEntityRef.trim(), relationType: p.relationType?.trim() } };
    }
    if (parsed.intent === "disable_module" && parsed.payload && "moduleSlug" in parsed.payload) {
      const p = parsed.payload as { moduleSlug: string };
      const mod = existingModules.find((m) => m.slug === slugify(p.moduleSlug) || m.slug === p.moduleSlug);
      if (mod) return { intent: "disable_module", payload: { moduleSlug: mod.slug } };
    }
    if (parsed.intent === "enable_module" && parsed.payload && "moduleSlug" in parsed.payload) {
      const p = parsed.payload as { moduleSlug: string };
      const mod = existingModules.find((m) => m.slug === slugify(p.moduleSlug) || m.slug === p.moduleSlug);
      if (mod) return { intent: "enable_module", payload: { moduleSlug: mod.slug } };
    }
    return null;
  } catch {
    return null;
  }
}

export async function parseDashboardIntent(
  prompt: string,
  existingModules: ModuleContext[],
  existingSlugs: string[]
): Promise<DashboardIntent> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("OPENAI_API_KEY is not set. Add it to your environment to use the AI prompt.");
  }
  const ai = await openaiParseDashboardIntent(prompt, existingModules, existingSlugs);
  if (!ai) {
    throw new Error("Could not understand the request. Please try rephrasing.");
  }
  return ai;
}

// -----------------------------------------------------------------------------
// Customer site AI (Phase 6)
// -----------------------------------------------------------------------------

export type SuggestedSite = {
  siteName: string;
  tagline: string;
  homeContent: string;
};

async function openaiSuggestSite(prompt: string): Promise<SuggestedSite | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const { OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey });
  const sys = `You suggest a simple customer-facing website from a short business description.
Return valid JSON only: { "siteName": "string", "tagline": "string", "homeContent": "string (HTML, 2-4 short paragraphs or sections, use <p> and <h2> only)" }.`;
  try {
    const res = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });
    const raw = res.choices[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SuggestedSite;
    if (!parsed.siteName || !parsed.tagline || typeof parsed.homeContent !== "string")
      return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function suggestSiteFromPrompt(prompt: string): Promise<SuggestedSite> {
  if (!process.env.OPENAI_API_KEY?.trim()) {
    throw new Error("OPENAI_API_KEY is not set. Add it to your environment to use AI suggestions.");
  }
  const ai = await openaiSuggestSite(prompt);
  if (!ai) {
    throw new Error("Could not generate site suggestion. Please try again.");
  }
  return ai;
}
