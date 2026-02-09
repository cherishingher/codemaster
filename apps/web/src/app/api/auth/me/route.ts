import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/authz";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  return NextResponse.json({ user });
}
