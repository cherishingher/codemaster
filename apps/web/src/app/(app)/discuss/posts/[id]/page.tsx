import { CommunityPostPage } from "@/components/community/community-post-page"

type PageProps = {
  params: Promise<{
    id: string
  }>
}

export default async function DiscussPostPage({ params }: PageProps) {
  const { id } = await params
  return <CommunityPostPage postId={id} />
}
