import type { Metadata } from "next";
import { getPublicAppUrl } from "@/lib/config/urls";

const appUrl = getPublicAppUrl();

export const metadata: Metadata = {
  title: "Reset Password",
  alternates: {
    canonical: `${appUrl}/reset-password`,
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
