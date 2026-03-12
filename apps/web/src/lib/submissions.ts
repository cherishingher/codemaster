export function getSubmissionStatusLabel(status?: string | null) {
  switch ((status ?? "").toUpperCase()) {
    case "ACCEPTED":
    case "AC":
      return "已通过"
    case "PARTIAL":
    case "PARTIAL_ACCEPTED":
      return "部分通过"
    case "WRONG_ANSWER":
    case "WA":
      return "答案错误"
    case "TIME_LIMIT_EXCEEDED":
    case "TLE":
      return "超时"
    case "MEMORY_LIMIT_EXCEEDED":
    case "MLE":
      return "超内存"
    case "RUNTIME_ERROR":
    case "RE":
      return "运行错误"
    case "COMPILE_ERROR":
    case "CE":
      return "编译错误"
    case "SYSTEM_ERROR":
      return "系统错误"
    case "PENDING":
    case "QUEUED":
      return "等待中"
    case "JUDGING":
    case "RUNNING":
      return "评测中"
    default:
      return status ?? "未知"
  }
}

export function getSubmissionStatusClass(status?: string | null) {
  switch ((status ?? "").toUpperCase()) {
    case "ACCEPTED":
    case "AC":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
    case "PARTIAL":
    case "PARTIAL_ACCEPTED":
      return "border-amber-500/40 bg-amber-500/10 text-amber-700"
    case "PENDING":
    case "QUEUED":
    case "JUDGING":
    case "RUNNING":
      return "border-blue-500/40 bg-blue-500/10 text-blue-700"
    case "COMPILE_ERROR":
    case "CE":
      return "border-yellow-600/40 bg-yellow-500/10 text-yellow-800"
    case "TIME_LIMIT_EXCEEDED":
    case "TLE":
    case "MEMORY_LIMIT_EXCEEDED":
    case "MLE":
      return "border-orange-500/40 bg-orange-500/10 text-orange-700"
    case "SYSTEM_ERROR":
      return "border-muted-foreground/30 bg-muted text-muted-foreground"
    default:
      return "border-red-500/40 bg-red-500/10 text-red-700"
  }
}
