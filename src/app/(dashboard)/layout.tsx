import { auth } from "@/auth";
import { redirect } from "next/navigation";
import DashboardStatusBanner from "@/components/dashboard/DashboardStatusBanner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/sign-in");
  }

  return (
    <>
      <DashboardStatusBanner userId={session.user.id} />
      {children}
    </>
  );
}
