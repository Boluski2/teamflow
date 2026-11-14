
import { NextRequest, NextResponse } from "next/server";

import { processDueSoonNotifications } from "@/lib/notifications/due-soon";

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET is not configured");

    return NextResponse.json(
      { error: "Cron endpoint is not configured" },
      { status: 500 },
    );
  }

  const authorization = request.headers.get("authorization");

  if (authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const result = await processDueSoonNotifications();

    return NextResponse.json({
      success: true,
      message: "Due-soon notifications processed",
      ...result,
    });
  } catch (error) {
    console.error("Due-soon notification processing failed", {
      errorName:
        error instanceof Error ? error.name : "UnknownError",
    });

    return NextResponse.json(
      { error: "Failed to process due-soon notifications" },
      { status: 500 },
    );
  }
}
