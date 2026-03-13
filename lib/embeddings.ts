/**
 * Generate and store embeddings for entity search_text. Uses OpenAI and optional pgvector.
 * When the embeddings table has an "embedding" column (vector), we store the vector for hybrid search.
 */

import { prisma } from "./prisma";

const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMS = 1536;

/** Generate embedding vector from text via OpenAI. Returns null if no API key or error. */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !text?.trim()) return null;
  try {
    const { OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey });
    const res = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.trim().slice(0, 8000),
    });
    const vec = res.data[0]?.embedding;
    return Array.isArray(vec) && vec.length === EMBEDDING_DIMS ? vec : null;
  } catch {
    return null;
  }
}

/** Upsert a single embedding row for an entity (content + optional vector). Call from entity create/update. */
export async function upsertEmbeddingForEntity(
  tenantId: string,
  entityId: string,
  content: string,
  modelName: string = EMBEDDING_MODEL
): Promise<void> {
  if (!content?.trim()) return;
  const text = content.trim().slice(0, 10000);
  const existing = await prisma.embedding.findFirst({
    where: { tenantId, entityId, relationshipId: null },
    select: { id: true },
  });
  const vector = await generateEmbedding(text);
  if (existing) {
    await prisma.embedding.update({
      where: { id: existing.id },
      data: { content: text, modelName },
    });
    if (vector) {
      try {
        const vecStr = "[" + vector.join(",") + "]";
        await prisma.$executeRawUnsafe(
          `UPDATE embeddings SET embedding = $1::vector WHERE id = $2`,
          vecStr,
          existing.id
        );
      } catch {
        // Column may not exist if pgvector migration not run
      }
    }
  } else {
    const row = await prisma.embedding.create({
      data: {
        tenantId,
        entityId,
        content: text,
        modelName,
      },
    });
    if (vector) {
      try {
        const vecStr = "[" + vector.join(",") + "]";
        await prisma.$executeRawUnsafe(
          `UPDATE embeddings SET embedding = $1::vector WHERE id = $2`,
          vecStr,
          row.id
        );
      } catch {
        // Column may not exist
      }
    }
  }
}
