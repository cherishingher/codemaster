import * as React from "react"
import { toast } from "sonner"

type CopyOptions = {
  errorTitle?: string
}

export function useCopyFeedback(resetMs = 1500) {
  const [copied, setCopied] = React.useState(false)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const copyText = React.useCallback(async (text: string, options?: CopyOptions) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        setCopied(false)
      }, resetMs)
      return true
    } catch (error) {
      toast.error(options?.errorTitle ?? "复制失败", {
        description: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }, [resetMs])

  return {
    copied,
    copyText,
  }
}
