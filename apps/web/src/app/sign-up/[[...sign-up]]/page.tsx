
import { Suspense } from "react";
import { SignUp } from "@clerk/nextjs";
import { getSafeRedirectUrl } from "@/lib/auth/redirect-url";

type SignUpPageProps = {
  searchParams: Promise<{
    redirect_url?: string | string[];
  }>;
};

export default function SignUpPage({
  searchParams,
}: SignUpPageProps) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <SignUpContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SignUpContent({
  searchParams,
}: SignUpPageProps) {
  const params = await searchParams;
  const redirectUrl = getSafeRedirectUrl(params.redirect_url);

  const signInUrl = redirectUrl
    ? `/sign-in?redirect_url=${encodeURIComponent(redirectUrl)}`
    : "/sign-in";

  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp
        forceRedirectUrl={redirectUrl}
        signInUrl={signInUrl}
      />
    </div>
  );
}
