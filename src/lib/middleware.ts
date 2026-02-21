import { getSession } from "@/lib/session";
import { getVerifiedAgent } from "@/services/agentService";
import { NextRequest } from "next/server";

export async function requireHumanAuth() {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED_HUMAN");
  }
  return session;
}

export async function requireAgentAuth(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("INVALID_API_KEY");
  }

  const key = authHeader.replace("Bearer ", "");
  const agent = await getVerifiedAgent(key);

  if (!agent) {
    throw new Error("INVALID_API_KEY");
  }

  return agent;
}

export async function requireAnyAuth(req: NextRequest) {
  try {
    return await requireHumanAuth();
  } catch {
    try {
      const agent = await requireAgentAuth(req);
      return { agent };
    } catch {
      throw new Error("UNAUTHORIZED");
    }
  }
}
