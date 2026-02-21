import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const SESSION_COOKIE_NAME = "taskhive_session";
const SECRET = process.env.SESSION_SECRET || "fallback-secret-at-least-32-chars-long";

export type SessionData = {
  userId: number;
};

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

export async function setSession(data: SessionData) {
  const payload = JSON.stringify(data);
  const signature = sign(payload);
  const value = Buffer.from(`${payload}.${signature}`).toString("base64");

  cookies().set(SESSION_COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });
}

export async function getSession(): Promise<SessionData | null> {
  const cookie = cookies().get(SESSION_COOKIE_NAME);
  if (!cookie) return null;

  try {
    const decoded = Buffer.from(cookie.value, "base64").toString("utf-8");
    const [payload, signature] = decoded.split(".");
    
    const expectedSignature = sign(payload);
    if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }

    return JSON.parse(payload) as SessionData;
  } catch {
    return null;
  }
}

export async function clearSession() {
  cookies().delete(SESSION_COOKIE_NAME);
}
