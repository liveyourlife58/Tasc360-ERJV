"use server";

import { headers } from "next/headers";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";

const MAX_UPLOAD_BYTES = 4_500_000;
const MAX_OUTPUT_BYTES = 4_400_000;
const MAX_DIMENSION = 2400;
const WEBP_QUALITY = 85;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];

export async function uploadBlob(
  _prev: unknown,
  formData: FormData
): Promise<{ url?: string; error?: string }> {
  const h = await headers();
  const userId = h.get("x-user-id");
  const tenantId = h.get("x-tenant-id");
  if (!userId || !tenantId) return { error: "Unauthorized" };
  const canSettings = await hasPermission(userId, PERMISSIONS.settingsManage);
  const canEntitiesWrite = await hasPermission(userId, PERMISSIONS.entitiesWrite);
  if (!canSettings && !canEntitiesWrite) return { error: "Unauthorized" };

  const file = formData.get("file");
  if (!file || !(file instanceof File)) return { error: "No file provided" };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "File too large (max 4.5 MB)" };
  if (!ALLOWED_TYPES.includes(file.type)) return { error: "Invalid file type. Use JPEG, PNG, GIF, WebP, or SVG." };

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "image";
  const isSvg = file.type === "image/svg+xml";

  try {
    const { storageUpload } = await import("@/lib/storage");

    if (isSvg) {
      const pathname = `uploads/${tenantId}/${Date.now()}-${safeName}`;
      const { url } = await storageUpload(pathname, file, {
        contentType: "image/svg+xml",
      });
      return { url };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const sharp = (await import("sharp")).default;
    let quality = WEBP_QUALITY;
    let outBuffer: Buffer;

    const basePath = `uploads/${tenantId}/${Date.now()}-${safeName.replace(/\.[a-z]+$/i, "")}.webp`;

    for (;;) {
      const pipeline = sharp(buffer)
        .rotate()
        .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
        .webp({ quality });

      outBuffer = await pipeline.toBuffer();
      if (outBuffer.length <= MAX_OUTPUT_BYTES || quality <= 40) break;
      quality = Math.max(40, quality - 15);
    }

    const { url } = await storageUpload(basePath, outBuffer, {
      contentType: "image/webp",
    });
    return { url };
  } catch (err) {
    console.error("Blob upload error:", err);
    return { error: err instanceof Error ? err.message : "Upload failed" };
  }
}
