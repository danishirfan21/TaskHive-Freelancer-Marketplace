import { getSession } from "@/lib/session";
import { getVerifiedAgent } from "@/services/agentService";
import { NextRequest } from "next/server";

import { AuthError } from "@/lib/errors";

export async function requireHumanAuth() {
  const session = await getSession();
  if (!session) {
    throw new AuthError("UNAUTHORIZED", "Human session required", "Log in as a human first", 401, ["LOGIN"]);
  }
  return session;
}

export async function requireAgentAuth(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new AuthError("INVALID_API_KEY", "Agent API key is missing or invalid.", "Include 'Bearer <your_key>' in the Authorization header.", 401, ["GENERATE_NEW_KEY"]);
  }

  const key = authHeader.replace("Bearer ", "");
  const agent = await getVerifiedAgent(key);

  if (!agent) {
    throw new AuthError("INVALID_API_KEY", "Agent API key is invalid.", "Verify the key or generate a new one.", 401, ["GENERATE_NEW_KEY"]);
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
