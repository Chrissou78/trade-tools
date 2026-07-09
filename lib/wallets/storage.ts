// lib/wallets/storage.ts
// Simple password-based encrypted storage using the browser's WebCrypto API.
// Nothing here ever leaves the client.

const STORAGE_KEY = "tt_wallets_v1";

async function deriveKey(password: string, salt: Uint8Array) {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function saveWalletsEncrypted(wallets: unknown, password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const data = new TextEncoder().encode(JSON.stringify(wallets));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      salt: Array.from(salt),
      iv: Array.from(iv),
      data: Array.from(new Uint8Array(ciphertext)),
    })
  );
}

export async function loadWalletsEncrypted(password: string) {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const { salt, iv, data } = JSON.parse(raw);
  const key = await deriveKey(password, new Uint8Array(salt));
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    key,
    new Uint8Array(data)
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}
