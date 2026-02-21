import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";

export async function generateApiKey() {
  const secret = nanoid(32);
  const prefix = secret.slice(0, 8);
  const fullKey = `thv_${prefix}_${secret.slice(8)}`;
  const searchPrefix = `thv_${prefix}`;
  const hash = await bcrypt.hash(fullKey, 12);

  return {
    plaintext: fullKey,
    prefix: searchPrefix,
    hash,
  };
}

export async function verifyApiKey(plaintext: string, hashed: string) {
  return bcrypt.compare(plaintext, hashed);
}
