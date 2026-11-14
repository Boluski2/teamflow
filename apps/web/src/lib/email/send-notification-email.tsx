
import "server-only";

import { Resend } from "resend";
import { render } from "react-email";

import NotificationEmail, {
  type NotificationEmailProps,
} from "@/lib/email/notification-email";

export type SendNotificationEmailInput = Omit<
  NotificationEmailProps,
  "appUrl"
> & {
  email: string;
  appUrl: string;
};

export type SendNotificationEmailResult =
  | {
      success: true;
      emailId: string;
    }
  | {
      success: false;
      reason: "configuration" | "provider" | "unexpected";
    };

function getEmailConfiguration() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim();
  const appUrl = process.env.APP_URL?.trim();

  if (!apiKey || !fromEmail || !appUrl) {
    return null;
  }

  try {
    const url = new URL(appUrl);

    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    return {
      apiKey,
      fromEmail,
      appUrl: url.origin,
    };
  } catch {
    return null;
  }
}

export async function sendNotificationEmail(
  input: SendNotificationEmailInput,
): Promise<SendNotificationEmailResult> {
  const config = getEmailConfiguration();

  if (!config) {
    console.error(
      "Notification email configuration is incomplete or invalid.",
    );

    return {
      success: false,
      reason: "configuration",
    };
  }

  try {
    const appUrl = new URL(input.appUrl, config.appUrl);

    // Never allow notification links to point outside the TeamFlow origin.
    if (appUrl.origin !== config.appUrl) {
      return {
        success: false,
        reason: "unexpected",
      };
    }

    const emailProps: NotificationEmailProps = {
      recipientName: input.recipientName,
      notificationType: input.notificationType,
      notificationTitle: input.notificationTitle,
      notificationMessage: input.notificationMessage,
      taskTitle: input.taskTitle,
      appUrl: appUrl.toString(),
    };

    const emailComponent = <NotificationEmail {...emailProps} />;

    const html = await render(emailComponent);
    const text = await render(emailComponent, {
      plainText: true,
    });

    const resend = new Resend(config.apiKey);

    const { data, error } = await resend.emails.send(
      {
        from: config.fromEmail,
        to: [input.email],
        subject: `${input.notificationTitle} | TeamFlow`,
        html,
        text,
      },
      {
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (error || !data?.id) {
      console.error("Resend notification delivery failed.", {
        statusCode: error?.statusCode ?? null,
      });

      return {
        success: false,
        reason: "provider",
      };
    }

    return {
      success: true,
      emailId: data.id,
    };
  } catch (error) {
    console.error("Unexpected notification email delivery error.", {
      errorName:
        error instanceof Error ? error.name : "UnknownError",
    });

    return {
      success: false,
      reason: "unexpected",
    };
  }
}
