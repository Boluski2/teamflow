import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { acceptInvitationSchema } from "@/lib/invitations/schema";
import AcceptInvitation from "./accept-invitation";

type InvitationPageProps = {
  searchParams: Promise<{
    token?: string | string[];
  }>;
};

export default async function InvitationPage({
  searchParams,
}: InvitationPageProps) {
  const params = await searchParams;
  const parsed = acceptInvitationSchema.safeParse({
    token: params.token,
  });

  if (!parsed.success) {
    return (
      <InvitationMessage
        title="Invalid invitation link"
        description="This invitation link is missing a valid token. Please ask the person who invited you to send another invitation."
      />
    );
  }

  const { userId } = await auth();

  if (!userId) {
    const redirectUrl = `/invitations/accept?token=${encodeURIComponent(
      parsed.data.token,
    )}`;

    const signInUrl = `/sign-in?redirect_url=${encodeURIComponent(
      redirectUrl,
    )}`;

    const signUpUrl = `/sign-up?redirect_url=${encodeURIComponent(
      redirectUrl,
    )}`;

    return (
      <InvitationMessage
        title="You've been invited to TeamFlow"
        description="Sign in to your account or create one to continue with this organization invitation."
      >
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={signInUrl}
            className="rounded-lg bg-blue-600 px-5 py-3 text-center text-sm font-medium text-white hover:bg-blue-700"
          >
            Sign in
          </Link>

          <Link
            href={signUpUrl}
            className="rounded-lg border border-gray-300 px-5 py-3 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Create account
          </Link>
        </div>
      </InvitationMessage>
    );
  }

  return <AcceptInvitation token={parsed.data.token} />;
}

function InvitationMessage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <p className="mb-6 text-sm font-semibold tracking-wide text-blue-600">
          TEAMFLOW
        </p>

        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          {title}
        </h1>

        <p className="mt-3 text-sm leading-6 text-gray-600">
          {description}
        </p>

        {children && <div className="mt-6">{children}</div>}
      </section>
    </main>
  );
}