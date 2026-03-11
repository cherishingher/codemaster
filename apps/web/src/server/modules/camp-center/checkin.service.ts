import { db } from "@/lib/db"
import type { CampCheckinResponse } from "@/lib/camps"
import { CampCenterError } from "@/server/modules/camp-center/shared"

export async function submitCampCheckin(
  userId: string,
  classId: string,
  taskId: string,
  note?: string,
): Promise<CampCheckinResponse> {
  return db.$transaction(async (tx) => {
    const [task, enrollment] = await Promise.all([
      tx.campTask.findUnique({
        where: { id: taskId },
      }),
      tx.campEnrollment.findFirst({
        where: {
          userId,
          classId,
          status: {
            in: ["ACTIVE", "COMPLETED"],
          },
        },
      }),
    ])

    if (!task || task.classId !== classId) {
      throw new CampCenterError("task_not_found", "训练营任务不存在", 404)
    }

    if (!enrollment) {
      throw new CampCenterError("not_enrolled", "当前班级尚未报名或未完成支付", 403)
    }

    const now = new Date()
    const checkin = await tx.campCheckin.upsert({
      where: {
        taskId_userId: {
          taskId,
          userId,
        },
      },
      update: {
        status: "checked_in",
        note: note ?? undefined,
        checkinAt: now,
        payload: note ? { note } : undefined,
      },
      create: {
        campId: task.campId,
        classId,
        taskId,
        enrollmentId: enrollment.id,
        userId,
        status: "checked_in",
        note,
        payload: note ? { note } : undefined,
        checkinAt: now,
      },
    })

    await tx.campEnrollment.update({
      where: { id: enrollment.id },
      data: {
        lastActiveAt: now,
      },
    })

    return {
      data: {
        id: checkin.id,
        taskId: checkin.taskId,
        classId: checkin.classId,
        status: checkin.status,
        note: checkin.note,
        checkinAt: checkin.checkinAt.toISOString(),
      },
    }
  })
}
