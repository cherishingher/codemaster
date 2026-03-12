export function isAdminDevRouteEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_ADMIN_DEV_ROUTES === "true"
}

export function isAdminDevToolsVisible() {
  return process.env.NEXT_PUBLIC_ALLOW_ADMIN_DEV_TOOLS === "true"
}
