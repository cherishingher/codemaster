import * as React from "react"
import { LoadingState } from "@/components/patterns/state-panel"

export default function Loading() {
  return (
    <div className="page-wrap flex min-h-[50vh] items-center py-12">
      <LoadingState />
    </div>
  )
}
