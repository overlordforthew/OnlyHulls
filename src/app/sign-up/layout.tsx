import type { Metadata } from "next";
import { getPublicAppUrl } from "@/lib/config/urls";

const appUrl = getPublicAppUrl();

export const metadata: Metadata = {
  title: "Create Account",
  alternates: {
    canonical: `${appUrl}/sign-up`,
  },
  robots: {
    index: false,
    follow: true,
  },
};

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
