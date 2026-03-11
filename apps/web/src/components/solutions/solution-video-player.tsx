"use client"

import Link from "next/link"
import { ExternalLink, MonitorPlay } from "lucide-react"
import { Button } from "@/components/ui/button"

type VideoRenderMode =
  | { kind: "native"; src: string }
  | { kind: "iframe"; src: string }
  | { kind: "external"; href: string }

function resolveVideoRenderMode(url: string): VideoRenderMode {
  try {
    const parsed = new URL(url)
    const normalizedHost = parsed.hostname.replace(/^www\./, "")
    const pathname = parsed.pathname.toLowerCase()

    if (/\.(mp4|webm|ogg|m3u8)(\?.*)?$/.test(pathname)) {
      return { kind: "native", src: url }
    }

    if (normalizedHost === "youtu.be") {
      const videoId = parsed.pathname.replace(/\//g, "")
      if (videoId) {
        return { kind: "iframe", src: `https://www.youtube.com/embed/${videoId}` }
      }
    }

    if (normalizedHost.includes("youtube.com")) {
      const videoId = parsed.searchParams.get("v")
      if (videoId) {
        return { kind: "iframe", src: `https://www.youtube.com/embed/${videoId}` }
      }
      if (pathname.startsWith("/embed/")) {
        return { kind: "iframe", src: url }
      }
    }

    if (normalizedHost.includes("bilibili.com")) {
      if (normalizedHost.startsWith("player.")) {
        return { kind: "iframe", src: url }
      }

      const bvMatch = parsed.pathname.match(/\/video\/(BV[\w]+)/i)
      if (bvMatch) {
        return {
          kind: "iframe",
          src: `https://player.bilibili.com/player.html?bvid=${bvMatch[1]}&page=1`,
        }
      }
    }

    if (normalizedHost.includes("vimeo.com")) {
      const videoId = parsed.pathname.split("/").filter(Boolean).pop()
      if (videoId) {
        return { kind: "iframe", src: `https://player.vimeo.com/video/${videoId}` }
      }
    }
  } catch {
    return { kind: "external", href: url }
  }

  return { kind: "external", href: url }
}

export function SolutionVideoPlayer({
  url,
  title,
}: {
  url: string
  title: string
}) {
  const mode = resolveVideoRenderMode(url)

  if (mode.kind === "native") {
    return (
      <div className="overflow-hidden rounded-[1.6rem] border-[3px] border-border bg-slate-950">
        <video className="aspect-video w-full bg-black" controls preload="metadata" src={mode.src} />
      </div>
    )
  }

  if (mode.kind === "iframe") {
    return (
      <div className="overflow-hidden rounded-[1.6rem] border-[3px] border-border bg-slate-950">
        <iframe
          title={title}
          src={mode.src}
          className="aspect-video w-full bg-black"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    )
  }

  return (
    <div className="rounded-[1.6rem] border-[3px] border-border bg-card px-5 py-5">
      <div className="space-y-3">
        <div className="inline-flex size-12 items-center justify-center rounded-[1rem] border-[2px] border-border bg-background">
          <MonitorPlay className="size-5 text-primary" />
        </div>
        <div className="space-y-2">
          <h4 className="text-lg font-semibold text-foreground">视频解析已绑定</h4>
          <p className="text-sm leading-7 text-muted-foreground">
            当前地址更适合作为外部链接打开，点击下方按钮查看完整视频解析。
          </p>
        </div>
        <Button asChild>
          <Link href={mode.href} target="_blank" rel="noreferrer">
            打开视频解析
            <ExternalLink className="size-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
