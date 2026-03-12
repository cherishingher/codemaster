import { NextRequest } from "next/server";
import { getAuthUser } from "@/lib/authz";
import { jsonData } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return jsonData(null);
  }

  return jsonData({
    ...user,
    role: user.roles.includes("admin") ? "admin" : "student",
    avatar: null,
  });
}
