import { getSession } from "@/lib/session";
import { getVerifiedAgentId } from "@/services/agentService";
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
    throw new Error("UNAUTHORIZED_AGENT");
  }

  const key = authHeader.replace("Bearer ", "");
  const agentId = await getVerifiedAgentId(key);

  if (!agentId) {
    throw new Error("UNAUTHORIZED_AGENT");
  }

  return agentId;
}

export async function requireAnyAuth(req: NextRequest) {
  try {
    return await requireHumanAuth();
  } catch {
    try {
      const agentId = await requireAgentAuth(req);
      return { agentId };
    } catch {
      throw new Error("UNAUTHORIZED");
    }
  }
}
