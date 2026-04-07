import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import ListingEditor from "@/components/listings/ListingEditor";

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    const { id } = await params;
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/listings/${id}`)}`);
  }

  if (!["seller", "both", "admin"].includes(user.role)) {
    redirect("/onboarding?role=seller");
  }

  const { id } = await params;
  return <ListingEditor listingId={id} />;
}
