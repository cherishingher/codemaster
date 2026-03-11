import { NextResponse } from "next/server"
import type { AuthUser } from "@/lib/authz"
import { getMembershipBenefits, getMembershipStatus } from "@/server/modules/membership/service"

function mapMembershipError(error: unknown) {
  console.error("[membership]", error)
  return NextResponse.json(
    {
      error: "internal_error",
      message: "会员信息加载失败，请稍后再试",
    },
    { status: 500 },
  )
}

export async function handleGetMembershipMe(user: AuthUser) {
  try {
    const membership = await getMembershipStatus(user.id)
    return NextResponse.json({ data: membership })
  } catch (error) {
    return mapMembershipError(error)
  }
}

export async function handleGetMembershipBenefits() {
  try {
    const benefits = await getMembershipBenefits()
    return NextResponse.json({ data: benefits })
  } catch (error) {
    return mapMembershipError(error)
  }
}
