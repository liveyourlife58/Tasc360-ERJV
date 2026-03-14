/**
 * Encrypt/decrypt integration credentials (e.g. OAuth tokens) for storage in Integration.credentialsEncrypted.
 * Set INTEGRATION_ENCRYPTION_KEY to a 32-byte hex string (64 chars). If missing, encrypt/decrypt return null.
 */

import { webcrypto } from "crypto";

const subtle = webcrypto.subtle;
const ALG = "AES-GCM";
const IV_LEN = 12;
const KEY_LEN = 32;

let keyPromise: Promise<CryptoKey | null> | null = null;

async function getKey(): Promise<CryptoKey | null> {
  if (keyPromise !== null) return keyPromise;
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!raw || typeof raw !== "string") {
    keyPromise = Promise.resolve(null);
    return null;
  }
  const bin = Buffer.from(raw.trim(), "hex");
  if (bin.length !== KEY_LEN) {
    keyPromise = Promise.resolve(null);
    return null;
  }
  keyPromise = subtle.importKey(
    "raw",
    bin,
    { name: ALG, length: KEY_LEN * 8 },
    false,
    ["encrypt", "decrypt"]
  );
  return keyPromise;
}

/**
 * Encrypt a plaintext string (e.g. JSON stringified tokens). Returns base64 or null if key not configured.
 */
export async function encryptIntegrationCredentials(plaintext: string): Promise<string | null> {
  const key = await getKey();
  if (!key) return null;
  const iv = webcrypto.getRandomValues(new Uint8Array(IV_LEN));
  const encoded = new TextEncoder().encode(plaintext);
  const cipher = await subtle.encrypt(
    { name: ALG, iv, tagLength: 128 },
    key,
    encoded
  );
  const combined = new Uint8Array(iv.length + cipher.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(cipher), iv.length);
  return Buffer.from(combined).toString("base64");
}

/**
 * Decrypt a value produced by encryptIntegrationCredentials. Returns null if key not configured or decryption fails.
 */
export async function decryptIntegrationCredentials(ciphertextBase64: string): Promise<string | null> {
  const key = await getKey();
  if (!key) return null;
  try {
    const combined = Buffer.from(ciphertextBase64, "base64");
    if (combined.length < IV_LEN + 16) return null;
    const iv = combined.subarray(0, IV_LEN);
    const cipher = combined.subarray(IV_LEN);
    const dec = await subtle.decrypt(
      { name: ALG, iv, tagLength: 128 },
      key,
      cipher
    );
    return new TextDecoder().decode(dec);
  } catch {
    return null;
  }
}

/**
 * True if INTEGRATION_ENCRYPTION_KEY is set and valid (32-byte hex). Use to gate "Connect" flows.
 */
export function isIntegrationEncryptionConfigured(): boolean {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!raw || typeof raw !== "string") return false;
  const bin = Buffer.from(raw.trim(), "hex");
  return bin.length === KEY_LEN;
}
