import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";

export async function generateApiKey() {
  const fullKey = `th_${nanoid(32)}`;
  const prefix = fullKey.slice(0, 11); // "th_" + 8 chars
  const hash = await bcrypt.hash(fullKey, 12);

  return {
    plaintext: fullKey,
    prefix,
    hash,
  };
}

export async function verifyApiKey(plaintext: string, hashed: string) {
  return bcrypt.compare(plaintext, hashed);
}
