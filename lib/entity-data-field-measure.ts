import { Prisma } from "@prisma/client";

/**
 * SQL fragment: true when `entities.data` has this key with a non-empty JSON value.
 * Used to block field removal / type changes. Does NOT treat these as blocking:
 * missing key, JSON null, "", whitespace-only strings, [], or {}.
 */
export function sqlEntityDataKeyHasMeaningfulValue(slug: string): Prisma.Sql {
  return Prisma.sql`(
    (data ? ${slug})
    AND NOT (
      jsonb_typeof(data->${slug}) = 'null'
      OR (jsonb_typeof(data->${slug}) = 'string' AND btrim(data->>${slug}) = '')
      OR (jsonb_typeof(data->${slug}) = 'array' AND jsonb_array_length(data->${slug}) = 0)
      OR (data->${slug} = '{}'::jsonb)
    )
  )`;
}
