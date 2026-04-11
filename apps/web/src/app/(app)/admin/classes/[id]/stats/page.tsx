import { redirect } from "next/navigation"

export default async function AdminClassStatsAliasPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/admin/teaching-groups/${id}/stats`)
}
