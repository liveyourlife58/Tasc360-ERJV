-- HNSW index for fast approximate nearest neighbor on embeddings (cosine distance).
-- Run after pgvector migration. Speeds up vector similarity search at scale.
CREATE INDEX IF NOT EXISTS "idx_embeddings_embedding_hnsw" ON "embeddings" USING hnsw ("embedding" vector_cosine_ops);
