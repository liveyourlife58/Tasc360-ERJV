/**
 * Storage abstraction for file uploads. Default implementation uses Vercel Blob.
 * Replace this implementation (e.g. S3, R2) without changing callers.
 */

export type UploadOptions = {
  contentType?: string;
  access?: "public" | "private";
  addRandomSuffix?: boolean;
};

export type UploadResult = { url: string };

/**
 * Upload a file. Returns the public URL (or signed URL for private).
 */
export async function storageUpload(
  pathname: string,
  body: Blob | Buffer | ArrayBuffer,
  options?: UploadOptions
): Promise<UploadResult> {
  const { put } = await import("@vercel/blob");
  const blob = await put(pathname, body, {
    access: options?.access ?? "public",
    addRandomSuffix: options?.addRandomSuffix ?? true,
    ...(options?.contentType && { contentType: options.contentType }),
  });
  return { url: blob.url };
}

/**
 * Delete one or more blobs by URL.
 */
export async function storageDelete(url: string | string[]): Promise<void> {
  const { del } = await import("@vercel/blob");
  await del(Array.isArray(url) ? url : [url]);
}
