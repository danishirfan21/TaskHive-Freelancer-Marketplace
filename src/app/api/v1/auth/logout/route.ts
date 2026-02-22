import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

export async function POST() {
  await clearSession();
  return NextResponse.json({ status: "SUCCESS", data: null, error: null, meta: {} });
}
