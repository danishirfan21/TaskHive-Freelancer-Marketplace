import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
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
      email: data.email,
      passwordHash,
    })
    .returning({
      id: users.id,
      email: users.email,
    });

  return user;
}

export async function loginUser(data: z.infer<typeof LoginSchema>) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1);

  if (!user) return null;

  const isValid = await bcrypt.compare(data.password, user.passwordHash);
  if (!isValid) return null;

  return {
    id: user.id,
    email: user.email,
  };
}
