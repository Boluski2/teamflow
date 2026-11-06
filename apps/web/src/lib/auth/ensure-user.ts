
import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/**
 * Resolves the authenticated Clerk identity to a
 * persistent TeamFlow user record.
 *
 * Returns the internal TeamFlow user, not the Clerk user.
 */
export async function ensureUser() {
  // 1. Confirm the current request has an authenticated identity.
  const { userId } = await auth();

  if (!userId) {
    throw new Error("Unauthorized");
  }

  // 2. Retrieve the user's profile from Clerk.
  const clerkUser = await currentUser();

  if (!clerkUser || clerkUser.id !== userId) {
    throw new Error("Unable to retrieve authenticated user");
  }

  // 3. Resolve the primary email address.
  const primaryEmail = clerkUser.emailAddresses.find(
    (email) => email.id === clerkUser.primaryEmailAddressId,
  );

  if (
    !primaryEmail ||
    primaryEmail.verification?.status !== "verified"
  ) {
    throw new Error("A verified primary email address is required");
  }

  const email = primaryEmail.emailAddress.trim().toLowerCase();

  // 4. Resolve a usable display name.
  const name =
    [clerkUser.firstName, clerkUser.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    clerkUser.username?.trim() ||
    email.split("@")[0];

  // 5. Create the TeamFlow user or update their profile.
  const [user] = await db
    .insert(users)
    .values({
      clerkUserId: clerkUser.id,
      email,
      name,
      avatarUrl: clerkUser.imageUrl,
    })
    .onConflictDoUpdate({
      target: users.clerkUserId,
      set: {
        email,
        name,
        avatarUrl: clerkUser.imageUrl,
        updatedAt: new Date(),
      },
    })
    .returning();

  if (!user) {
    throw new Error("Unable to synchronize TeamFlow user");
  }

  // 6. Respect administrative account deactivation.
  if (!user.isActive) {
    throw new Error("Your TeamFlow account has been deactivated");
  }

  return user;
}
