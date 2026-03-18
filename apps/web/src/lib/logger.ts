const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "secret",
  "code",
  "codeHash",
  "debugCode",
  "accessKeyId",
  "accessKeySecret",
  "authorization",
  "cookie",
  "cm_session",
]);

function redactValue(key: string, value: unknown): unknown {
  if (typeof value === "string" && SENSITIVE_KEYS.has(key.toLowerCase())) {
    if (value.length <= 4) return "***";
    return value.slice(0, 2) + "***" + value.slice(-2);
  }
  return value;
}

function redactObject(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      result[key] = redactObject(value as Record<string, unknown>);
    } else {
      result[key] = redactValue(key, value);
    }
  }
  return result;
}

export function safeLog(level: "info" | "warn" | "error", message: string, data?: Record<string, unknown>) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(data ? redactObject(data) : {}),
  };
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else if (level === "warn") {
    console.warn(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}
