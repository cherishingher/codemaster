import { NextResponse } from "next/server"
import { withAuth } from "@/lib/authz"
import { getOrCreateTestdataTaskPackage, TestdataPackageError } from "@/lib/testdata-gen/package"

export const GET = withAuth(async (_req, { params }) => {
  try {
    const result = await getOrCreateTestdataTaskPackage(params.taskId)
    return new NextResponse(result.buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Length": String(result.buffer.byteLength),
        "Content-Disposition": `attachment; filename="${result.asset.fileName}"`,
        "X-Testdata-Package-Generated": result.generated ? "true" : "false",
      },
    })
  } catch (error) {
    if (error instanceof TestdataPackageError) {
      return NextResponse.json(
        {
          error: error.code,
          message: error.message,
        },
        { status: error.status }
      )
    }
    return NextResponse.json(
      {
        error: "package_download_failed",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}, { roles: "admin" })

export const runtime = "nodejs"
