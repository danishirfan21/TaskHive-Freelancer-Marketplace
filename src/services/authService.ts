import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

export const RegisterSchema = z.object({
  email: z.string().email(),
  // bcrypt only uses the first 72 bytes, so longer passwords add nothing but cost.
  password: z.string().min(8).max(72),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function registerUser(data: z.infer<typeof RegisterSchema>) {
  const passwordHash = await bcrypt.hash(data.password, 12);
  
  const [user] = await db
    .insert(users)
    .values({
      email: data.email.trim().toLowerCase(),
      passwordHash,
    })
    .returning({
      id: users.id,
      email: users.email,
    });

  return user;
}

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = "$2a$12$Vql4o3QXPUCbDRdnUhosQeni70ygxVjCeDiP9yMNIjnRSroRz6Pti";

export async function loginUser(data: z.infer<typeof LoginSchema>) {
  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${data.email.trim().toLowerCase()}`)
    .limit(1);

  if (!user) {
    await bcrypt.compare(data.password, DUMMY_HASH);
    return null;
  }

  const isValid = await bcrypt.compare(data.password, user.passwordHash);
  if (!isValid) return null;

  return {
    id: user.id,
    email: user.email,
  };
}
