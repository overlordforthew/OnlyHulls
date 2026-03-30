import { auth } from "@/auth";
import { queryOne } from "@/lib/db";
import type { UserRole, SubscriptionTier } from "@/lib/config/plans";

export interface AppUser {
  id: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  subscriptionTier: SubscriptionTier;
  stripeCustomerId: string | null;
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await queryOne<{
    id: string;
    email: string;
    display_name: string | null;
    role: UserRole;
    subscription_tier: SubscriptionTier;
    stripe_customer_id: string | null;
  }>("SELECT id, email, display_name, role, subscription_tier, stripe_customer_id FROM users WHERE id = $1", [session.user.id]);

  if (!user) return null;

  return {
    id: user.id,
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
