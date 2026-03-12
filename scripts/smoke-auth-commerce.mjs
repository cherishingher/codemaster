import { assert, findProduct, getSmokeConfig, logStep, login, requestJson, seedIfConfigured } from "./lib/smoke-common.mjs"

const config = getSmokeConfig()

async function main() {
  await seedIfConfigured(config)

  const session = await login(config.baseUrl, config.email, config.password)
  logStep("logged_in", { email: config.email, userId: session.user?.id ?? null })

  const products = await requestJson(config.baseUrl, "/api/products", {
    cookie: session.cookie,
  })
  const items = products.data?.data ?? []
  assert(Array.isArray(items) && items.length > 0, "products list is empty")

  const product = findProduct(items, config.productSlug)
  assert(product?.defaultSku?.id, `product with default sku not found for slug ${config.productSlug}`)
  logStep("product_selected", {
    slug: product.slug,
    productId: product.id,
    skuId: product.defaultSku.id,
  })

  const createdOrder = await requestJson(config.baseUrl, "/api/orders", {
    method: "POST",
    cookie: session.cookie,
    expectedStatus: 201,
    json: {
      productId: product.id,
      skuId: product.defaultSku.id,
    },
  })
  const order = createdOrder.data?.data
  assert(order?.id, "order id missing from create order response")
  assert(order.status === "CREATED", `expected CREATED order, got ${order.status}`)
  logStep("order_created", { orderId: order.id, orderNo: order.orderNo })

  const paidOrder = await requestJson(config.baseUrl, `/api/orders/${order.id}/pay`, {
    method: "POST",
    cookie: session.cookie,
    json: {
      channel: "MOCK",
    },
  })
  const paid = paidOrder.data?.data
  assert(paid?.status === "COMPLETED" || paid?.status === "PAID", `unexpected paid order status ${paid?.status}`)
  logStep("order_paid", { orderId: order.id, status: paid.status, channel: paid.channel })

  const membership = await requestJson(config.baseUrl, "/api/membership/me", {
    cookie: session.cookie,
  })
  assert(membership.data?.data?.status === "ACTIVE", `expected ACTIVE membership, got ${membership.data?.data?.status}`)
  logStep("membership_active", {
    status: membership.data.data.status,
    expiresAt: membership.data.data.expiresAt ?? null,
  })

  const access = await requestJson(
    config.baseUrl,
    "/api/access/check?resourceType=training_path&resourceId=dynamic-programming",
    {
      cookie: session.cookie,
    },
  )
  assert(access.data?.data?.allowed === true, "expected unlocked training path access after purchase")
  logStep("content_unlocked", {
    resourceType: access.data.data.resourceType,
    resourceId: access.data.data.resourceId,
    grantedBy: access.data.data.grantedBy,
  })

  console.log("[smoke] auth-commerce ok")
}

main().catch((error) => {
  console.error("[smoke] auth-commerce failed", error)
  process.exitCode = 1
})
