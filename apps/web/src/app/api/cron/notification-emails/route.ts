
import { NextResponse } from "next/server";

import { processNotificationEmails } from "@/lib/email/process-notification-emails";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: "Cron service is not configured" },
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
    const result = await processNotificationEmails();

    return NextResponse.json({
      success: true,
      message: "Notification email processing completed",
      result,
    });
  } catch (error) {
    console.error("Notification email cron failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    return NextResponse.json(
      { error: "Notification email processing failed" },
      { status: 500 },
    );
  }
}
