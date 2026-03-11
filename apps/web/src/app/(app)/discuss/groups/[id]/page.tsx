import { StudyGroupPage } from "@/components/community/study-group-page"

type PageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function DiscussGroupPage({ params }: PageProps) {
  const { id } = await params
  return <StudyGroupPage groupIdOrSlug={id} />
}
