// Password hashing using Web Crypto SubtleCrypto.
// Supports two formats:
//   1. Custom PBKDF2 hex   — "hashHex:saltHex"  (created by this API)
//   2. ASP.NET Core Identity v3 PBKDF2 — Base64 blob (existing users from .NET backend)

const getSubtle = (): SubtleCrypto => {
  if (typeof crypto !== 'undefined' && crypto.subtle) return crypto.subtle;
  return (require('node:crypto') as any).webcrypto.subtle;
};

export const hashPassword = async (password: string): Promise<string> => {
  const subtle = getSubtle();
  const enc = new TextEncoder();
  const salt = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(salt);
  } else {
    (require('node:crypto') as any).randomFillSync(salt);
  }

  const key = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);

  const toHex = (u: Uint8Array) => Array.from(u).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${toHex(new Uint8Array(bits))}:${toHex(salt)}`;
};

export const verifyPassword = async (password: string, stored: string): Promise<boolean> => {
  if (!stored || !password) return false;
  const subtle = getSubtle();
  const enc = new TextEncoder();

  // ── Format 1: hashHex:saltHex ────────────────────────────────────────────
  if (stored.includes(':')) {
    try {
      const [hashHex, saltHex] = stored.split(':');
      if (!hashHex || !saltHex) return false;
      const salt = new Uint8Array((saltHex.match(/.{2}/g) ?? []).map(b => parseInt(b, 16)));
      const key = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
      const bits = await subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256);
      const computed = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
      return computed === hashHex;
    } catch {
      return false;
    }
  }

  // ── Format 2: ASP.NET Core Identity v3 Base64 ────────────────────────────
  try {
    const bin = atob(stored);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    if (bytes[0] !== 1) return false; // only V3 supported

    const view = new DataView(bytes.buffer, bytes.byteOffset);
    const prf = view.getUint32(1, false);       // 1 = HMACSHA256
    const iters = view.getUint32(5, false);
    const saltLen = view.getUint32(9, false);
    const salt = bytes.subarray(13, 13 + saltLen);
    const expected = bytes.subarray(13 + saltLen);
    const hashAlg = prf === 1 ? 'SHA-256' : prf === 2 ? 'SHA-512' : 'SHA-1';

    const key = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: iters, hash: hashAlg },
      key, expected.length * 8
    );
    const derived = new Uint8Array(bits);
    if (derived.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < derived.length; i++) diff |= derived[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
};
