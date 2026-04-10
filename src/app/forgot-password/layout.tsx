import type { Metadata } from "next";
import { getPublicAppUrl } from "@/lib/config/urls";

const appUrl = getPublicAppUrl();

export const metadata: Metadata = {
  title: "Forgot Password",
  alternates: {
    canonical: `${appUrl}/forgot-password`,
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
