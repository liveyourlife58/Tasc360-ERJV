"use client";

import { useRef, useState } from "react";
import { uploadBlob } from "@/app/dashboard/upload-actions";

type Props = {
  /** Form field name for the URL (e.g. siteHeroImage) */
  name: string;
  /** Current URL value */
  defaultValue?: string;
  /** Label for the URL input */
  label?: string;
  /** Accept attribute for the file input (default: images) */
  accept?: string;
  /** Placeholder for the URL input */
  placeholder?: string;
  /** Input id for the URL field */
  id?: string;
  className?: string;
  /** Whether the URL input is required */
  required?: boolean;
};

export function BlobUploadInput({
  name,
  defaultValue = "",
  label,
  accept = "image/jpeg,image/png,image/gif,image/webp,image/svg+xml",
  placeholder = "https://... or upload below",
  id,
  className = "",
  required = false,
}: Props) {
  const urlInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const result = await uploadBlob(null, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.url && urlInputRef.current) {
        urlInputRef.current.value = result.url;
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className={`form-group ${className}`.trim()}>
      {label && <label htmlFor={id ?? name}>{label}</label>}
      <input
        ref={urlInputRef}
        type="url"
        id={id ?? name}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="form-control"
        style={{ marginBottom: "0.5rem" }}
        required={required}
      />
      <div className="blob-upload-row">
        <label className="blob-upload-label">
          <input
            type="file"
            accept={accept}
            onChange={handleFileChange}
            disabled={uploading}
            className="blob-upload-file"
            aria-label="Upload image"
          />
          <span className="btn btn-secondary btn-sm">
            {uploading ? "Uploading…" : "Upload image"}
          </span>
        </label>
      </div>
      {error && <p className="view-error" role="alert" style={{ marginTop: "0.5rem" }}>{error}</p>}
    </div>
  );
}
