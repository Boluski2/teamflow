
import { Suspense } from "react";
import { SignIn } from "@clerk/nextjs";
import { getSafeRedirectUrl } from "@/lib/auth/redirect-url";

type SignInPageProps = {
  searchParams: Promise<{
    redirect_url?: string | string[];
  }>;
};

export default function SignInPage({
  searchParams,
}: SignInPageProps) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <SignInContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SignInContent({
  searchParams,
}: SignInPageProps) {
  const params = await searchParams;
  const redirectUrl = getSafeRedirectUrl(params.redirect_url);

  const signUpUrl = redirectUrl
    ? `/sign-up?redirect_url=${encodeURIComponent(redirectUrl)}`
    : "/sign-up";

  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn
        forceRedirectUrl={redirectUrl}
        signUpUrl={signUpUrl}
      />
    </div>
  );
}
