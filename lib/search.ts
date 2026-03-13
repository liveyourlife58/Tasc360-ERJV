/**
 * Full-text and optional hybrid (FTS + vector) search over tenant entities.
 * Uses entities.search_text and the GIN FTS index; optional pgvector on embeddings.
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { generateEmbedding } from "./embeddings";

export type SearchResult = {
  entityId: string;
  moduleId: string | null;
  data: Record<string, unknown>;
  searchText: string | null;
  rank?: number;
};

/**
 * Full-text search on entities.search_text (tenant-scoped).
 */
export async function searchEntitiesFts(
  tenantId: string,
  query: string,
  options: { moduleId?: string; limit?: number } = {}
): Promise<SearchResult[]> {
  const limit = Math.min(100, options.limit ?? 20);
  const q = (query ?? "").trim();
  if (!q) return [];

  const moduleFilter = options.moduleId
    ? Prisma.sql`AND e.module_id = ${options.moduleId}::uuid`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<{ id: string; module_id: string | null; data: unknown; search_text: string | null; rank: number }[]>`
    SELECT e.id, e.module_id, e.data, e.search_text,
           ts_rank(to_tsvector('english', COALESCE(e.search_text, '')), plainto_tsquery('english', ${q})) AS rank
    FROM entities e
    WHERE e.tenant_id = ${tenantId}::uuid
      AND e.deleted_at IS NULL
      ${moduleFilter}
      AND to_tsvector('english', COALESCE(e.search_text, '')) @@ plainto_tsquery('english', ${q})
    ORDER BY rank DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    entityId: r.id,
    moduleId: r.module_id,
    data: (r.data as Record<string, unknown>) ?? {},
    searchText: r.search_text,
    rank: Number(r.rank),
  }));
}

/**
 * Vector similarity search (when pgvector embedding column exists). Returns results ordered by cosine similarity.
 */
export async function searchEntitiesVector(
  tenantId: string,
  queryVector: number[],
  options: { moduleId?: string; limit?: number } = {}
): Promise<SearchResult[]> {
  const limit = Math.min(100, options.limit ?? 20);
  if (!queryVector?.length) return [];
  const vecStr = "[" + queryVector.join(",") + "]";
  try {
    const rows = options.moduleId
      ? await prisma.$queryRawUnsafe<
          { id: string; module_id: string | null; data: unknown; search_text: string | null; rank: number }[]
        >(
          `SELECT e.id, e.module_id, e.data, e.search_text,
                  (1 - (emb.embedding <=> $1::vector))::float AS rank
           FROM entities e
           INNER JOIN embeddings emb ON emb.entity_id = e.id AND emb.tenant_id = e.tenant_id
           WHERE e.tenant_id = $2 AND e.module_id = $3::uuid AND e.deleted_at IS NULL AND emb.embedding IS NOT NULL
           ORDER BY emb.embedding <=> $1::vector
           LIMIT $4`,
          vecStr,
          tenantId,
          options.moduleId,
          limit
        )
      : await prisma.$queryRawUnsafe<
          { id: string; module_id: string | null; data: unknown; search_text: string | null; rank: number }[]
        >(
          `SELECT e.id, e.module_id, e.data, e.search_text,
                  (1 - (emb.embedding <=> $1::vector))::float AS rank
           FROM entities e
           INNER JOIN embeddings emb ON emb.entity_id = e.id AND emb.tenant_id = e.tenant_id
           WHERE e.tenant_id = $2 AND e.deleted_at IS NULL AND emb.embedding IS NOT NULL
           ORDER BY emb.embedding <=> $1::vector
           LIMIT $3`,
          vecStr,
          tenantId,
          limit
        );
    return rows.map((r) => ({
      entityId: r.id,
      moduleId: r.module_id,
      data: (r.data as Record<string, unknown>) ?? {},
      searchText: r.search_text,
      rank: Number(r.rank),
    }));
  } catch {
    return [];
  }
}

/**
 * Hybrid search: FTS + vector (when OpenAI and pgvector available). Merges results by entity id with combined rank.
 */
export async function searchEntitiesHybrid(
  tenantId: string,
  query: string,
  options: { moduleId?: string; limit?: number } = {}
): Promise<SearchResult[]> {
  const limit = Math.min(100, options.limit ?? 20);
  const q = (query ?? "").trim();
  if (!q) return [];

  const [ftsResults, queryVector] = await Promise.all([
    searchEntitiesFts(tenantId, q, { ...options, limit: limit * 2 }),
    generateEmbedding(q),
  ]);
  let vectorResults: SearchResult[] = [];
  if (queryVector) {
    vectorResults = await searchEntitiesVector(tenantId, queryVector, { ...options, limit: limit * 2 });
  }
  if (vectorResults.length === 0) return ftsResults.slice(0, limit);
  const byId = new Map<string, SearchResult & { score: number }>();
  const ftsMax = Math.max(...ftsResults.map((r) => r.rank ?? 0), 1);
  const vecMax = Math.max(...vectorResults.map((r) => r.rank ?? 0), 1);
  for (const r of ftsResults) {
    const score = (r.rank ?? 0) / ftsMax;
    byId.set(r.entityId, { ...r, score: byId.get(r.entityId)?.score ? byId.get(r.entityId)!.score + score : score });
  }
  for (const r of vectorResults) {
    const score = (r.rank ?? 0) / vecMax;
    const existing = byId.get(r.entityId);
    byId.set(r.entityId, { ...r, score: existing ? existing.score + score : score });
  }
  const merged = Array.from(byId.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ score: _s, ...r }) => r);
  return merged;
}
