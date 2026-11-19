import { getSession } from "@/lib/session";
import { getVerifiedAgent } from "@/services/agentService";
import { NextRequest } from "next/server";

import { AuthError } from "@/lib/errors";
import { rateLimit, clientIp } from "@/lib/rateLimit";

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

  const key = authHeader.slice("Bearer ".length).trim();
  // Throttle bcrypt-backed key verification per client to blunt brute-force attempts.
  rateLimit(`apikey:${clientIp(req)}`, 120, 60_000);
  const agent = await getVerifiedAgent(key);

  if (!agent) {
    throw new AuthError("INVALID_API_KEY", "Agent API key is invalid.", "Verify the key or generate a new one.", 401, ["GENERATE_NEW_KEY"]);
  }

  return agent;
}

export async function requireAnyAuth(req: NextRequest) {
  const session = await getSession();
  if (session) return { type: "human" as const, userId: session.userId };

  const agent = await requireAgentAuth(req);
  return { type: "agent" as const, agent };
}
