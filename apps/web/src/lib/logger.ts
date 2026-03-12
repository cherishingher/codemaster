type LogLevel = "info" | "warn" | "error"

type LogContext = Record<string, unknown>

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  return error
}

function writeLog(level: LogLevel, scope: string, event: string, context: LogContext = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    scope,
    event,
    ...Object.fromEntries(
      Object.entries(context).map(([key, value]) => [key, key === "error" ? serializeError(value) : value]),
    ),
  }

  const line = JSON.stringify(payload)

  if (level === "error") {
    console.error(line)
    return
  }

  if (level === "warn") {
    console.warn(line)
    return
  }

  console.log(line)
}

export function createLogger(scope: string) {
  return {
    info(event: string, context?: LogContext) {
      writeLog("info", scope, event, context)
    },
    warn(event: string, context?: LogContext) {
      writeLog("warn", scope, event, context)
    },
    error(event: string, context?: LogContext) {
      writeLog("error", scope, event, context)
    },
  }
}
