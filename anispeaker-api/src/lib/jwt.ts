import { SignJWT, jwtVerify } from 'jose';

const DEFAULT_SECRET = 'anispeaker_super_secret_key_2026';

const getKey = (secret?: string) =>
  new TextEncoder().encode(secret || (typeof process !== 'undefined' && process.env?.JWT_SECRET) || DEFAULT_SECRET);

export const signToken = async (payload: any, secret?: string, expiresS = 86400 * 7) =>
  new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expiresS}s`)
    .sign(getKey(secret));

export const verifyToken = async (token: string, secret?: string) => {
  try {
    const { payload } = await jwtVerify(token, getKey(secret));
    return payload;
  } catch {
    return null;
  }
};
