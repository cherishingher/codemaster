import process from "node:process"

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "")
}

export function getSmokeConfig() {
  return {
    baseUrl: normalizeBaseUrl(process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000"),
    email: process.env.SMOKE_EMAIL ?? "demo@student.local",
    password: process.env.SMOKE_PASSWORD ?? "Demo123456",
    adminEmail: process.env.SMOKE_ADMIN_EMAIL ?? "",
    adminPassword: process.env.SMOKE_ADMIN_PASSWORD ?? "",
    seed: process.env.SMOKE_SEED === "true",
    productSlug: process.env.SMOKE_PRODUCT_SLUG ?? "vip-membership",
  }
}

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

export function logStep(message, details = undefined) {
  const suffix = details ? ` ${JSON.stringify(details)}` : ""
  console.log(`[smoke] ${message}${suffix}`)
}

export async function requestJson(baseUrl, path, options = {}) {
  const method = options.method ?? "GET"
  const expectedStatus = Array.isArray(options.expectedStatus)
    ? options.expectedStatus
    : [options.expectedStatus ?? 200]
  const headers = new Headers(options.headers ?? {})

  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json")
  }

  if (options.cookie) {
    headers.set("Cookie", options.cookie)
  }

  if (!headers.has("Origin")) {
    headers.set("Origin", baseUrl)
  }

  let body
  if (options.json !== undefined) {
    headers.set("Content-Type", "application/json")
    body = JSON.stringify(options.json)
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body,
    redirect: "manual",
  })

  const text = await response.text()
  let data = null

  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!expectedStatus.includes(response.status)) {
    throw new Error(
      `${method} ${path} expected ${expectedStatus.join("/")} but got ${response.status}: ${
        typeof data === "string" ? data : JSON.stringify(data)
      }`,
    )
  }

  return {
    response,
    status: response.status,
    data,
  }
}

function mergeCookies(existing, nextValues) {
  const jar = new Map()

  for (const item of existing ? existing.split(/;\s*/) : []) {
    if (!item) continue
    const [name, ...rest] = item.split("=")
    jar.set(name, rest.join("="))
  }

  for (const cookie of nextValues) {
    const [pair] = cookie.split(";")
    const [name, ...rest] = pair.split("=")
    jar.set(name, rest.join("="))
  }

  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ")
}

export async function login(baseUrl, identifier, password) {
  const result = await requestJson(baseUrl, "/api/auth/login", {
    method: "POST",
    json: { identifier, password },
    expectedStatus: 200,
  })

  const cookies = result.response.headers.getSetCookie?.() ?? []
  const cookie = mergeCookies("", cookies)
  assert(cookie.length > 0, "login did not return session cookies")

  return {
    cookie,
    user: result.data?.user ?? null,
  }
}

export async function seedIfConfigured(config) {
  if (!config.seed) {
    return null
  }

  assert(config.adminEmail && config.adminPassword, "SMOKE_SEED=true requires SMOKE_ADMIN_EMAIL and SMOKE_ADMIN_PASSWORD")

  const adminSession = await login(config.baseUrl, config.adminEmail, config.adminPassword)
  const seeded = await requestJson(config.baseUrl, "/api/admin/dev/seed", {
    method: "POST",
    cookie: adminSession.cookie,
    expectedStatus: 200,
  })

  logStep("seed_ready", seeded.data)
  return seeded.data
}

export function findProduct(products, slug) {
  return products.find((item) => item.slug === slug) ?? products.find((item) => item.defaultSku)
}
