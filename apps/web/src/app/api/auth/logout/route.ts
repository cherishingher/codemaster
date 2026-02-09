import { NextRequest, NextResponse } from "next/server";
import { deleteSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const token = req.cookies.get("cm_session")?.value;
  if (token) {
    await deleteSession(token);
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: "cm_session",
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
  });
  return res;
}
