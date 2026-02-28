import { auth, currentUser } from "@clerk/nextjs/server";
import { queryOne } from "@/lib/db";
import type { UserRole, SubscriptionTier } from "@/lib/config/plans";

export interface AppUser {
  id: string;
  clerkId: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  subscriptionTier: SubscriptionTier;
  stripeCustomerId: string | null;
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await queryOne<{
    id: string;
    clerk_id: string;
    email: string;
    display_name: string | null;
    role: UserRole;
    subscription_tier: SubscriptionTier;
    stripe_customer_id: string | null;
  }>("SELECT * FROM users WHERE clerk_id = $1", [userId]);

  if (!user) return null;

  return {
    id: user.id,
    clerkId: user.clerk_id,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
    subscriptionTier: user.subscription_tier,
    stripeCustomerId: user.stripe_customer_id,
  };
}

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requireRole(roles: UserRole[]): Promise<AppUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) {
    throw new Error("Forbidden");
  }
  return user;
}

export async function getClerkUser() {
  return currentUser();
}
