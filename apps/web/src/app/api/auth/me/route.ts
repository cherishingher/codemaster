import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/authz";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json(null);
  }

  return NextResponse.json({
    ...user,
    role: user.roles.includes("admin") ? "admin" : "student",
    avatar: null,
  });
}
