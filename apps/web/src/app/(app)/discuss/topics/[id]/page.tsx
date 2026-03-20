import { DiscussionTopicPage } from "@/components/discussions/discussion-topic-page"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function DiscussionTopicRoute({ params }: PageProps) {
  const { id } = await params
  return <DiscussionTopicPage topicId={id} />
}
