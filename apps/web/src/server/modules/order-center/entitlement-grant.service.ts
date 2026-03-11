import { Prisma } from "@prisma/client"
import { activateCampEnrollmentForOrder } from "@/server/modules/camp-center/enrollment.service"
import { activateContestRegistrationForOrder } from "@/server/modules/contest-center/registration.service"
import { grantEntitlementInTx } from "@/server/modules/content-access/service"
import { syncMembershipSubscriptionForOrder } from "@/server/modules/membership/service"

export async function grantEntitlementForPayment(
  tx: Prisma.TransactionClient,
  paymentId: string,
) {
  const payment = await tx.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: {
        include: {
          product: true,
          sku: true,
        },
      },
    },
  })

  if (!payment || payment.status !== "SUCCEEDED") {
    return { granted: false, expiresAt: null as Date | null }
  }

  const order = payment.order
  if (!order.productId || !order.product) {
    return { granted: false, expiresAt: null as Date | null }
  }

  const paidAt = payment.paidAt ?? order.paidAt ?? new Date()

  const claimed = await tx.payment.updateMany({
    where: {
      id: payment.id,
      status: "SUCCEEDED",
      entitlementGrantedAt: null,
    },
    data: {
      entitlementGrantedAt: paidAt,
    },
  })

  if (claimed.count === 0) {
    return { granted: false, expiresAt: null as Date | null }
  }
  const entitlement = await grantEntitlementInTx(tx, order.userId, "PURCHASE", order.id, paidAt)

  await syncMembershipSubscriptionForOrder(tx, order.id, paidAt)
  await activateCampEnrollmentForOrder(tx, order.id, paidAt)
  await activateContestRegistrationForOrder(tx, order.id, paidAt)

  return { granted: true, expiresAt: entitlement.expiresAt }
}
