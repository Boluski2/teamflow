
import "server-only";

import { Resend } from "resend";
import { render } from "react-email";

import InvitationEmail, {
  type InvitationEmailProps,
} from "@/emails/invitation-email";

type SendInvitationEmailInput = {
  email: string;
  inviterName: string;
  organizationName: string;
  role: InvitationEmailProps["role"];
  token: string;
};

export type SendInvitationEmailResult =
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

export async function sendInvitationEmail(
  input: SendInvitationEmailInput,
): Promise<SendInvitationEmailResult> {
  const config = getEmailConfiguration();

  if (!config) {
    console.error("Invitation email configuration is incomplete or invalid.");

    return {
      success: false,
      reason: "configuration",
    };
  }

  try {
    const invitationUrl = new URL(
      "/invitations/accept",
      config.appUrl,
    );

    invitationUrl.searchParams.set("token", input.token);

    const emailProps: InvitationEmailProps = {
      inviterName: input.inviterName,
      organizationName: input.organizationName,
      role: input.role,
      invitationUrl: invitationUrl.toString(),
    };

    const html = await render(
      <InvitationEmail {...emailProps} />,
    );

    const text = await render(
      <InvitationEmail {...emailProps} />,
      { plainText: true },
    );

    const resend = new Resend(config.apiKey);

    const { data, error } = await resend.emails.send(
      {
        from: config.fromEmail,
        to: [input.email],
        subject: `You're invited to join ${input.organizationName} on TeamFlow`,
        html,
        text,
      },
      {
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (error || !data?.id) {
      console.error("Resend invitation delivery failed.", {
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
    console.error("Unexpected invitation email delivery error.", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    return {
      success: false,
      reason: "unexpected",
    };
  }
}
