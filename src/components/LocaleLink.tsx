"use client";

import Link, { type LinkProps } from "next/link";
import { useLocale } from "next-intl";
import { forwardRef, type AnchorHTMLAttributes, type ReactNode, type Ref } from "react";
import { localizedHref } from "@/i18n/href";

// Drop-in replacement for next/link that prefixes the href with the current
// locale (e.g. /es/boats when the user is on Spanish pages). Works for:
//   - string hrefs: "/boats", "/boats/slug"
//   - UrlObject hrefs: we only mutate the pathname and leave query/hash alone.
// Absolute URLs and hash-only links pass through untouched.

type LinkUrl = LinkProps["href"];

function rewriteHref(href: LinkUrl, locale: string): LinkUrl {
  if (typeof href === "string") {
    return localizedHref(href, locale);
  }
  if (href && typeof href === "object" && typeof href.pathname === "string") {
    return { ...href, pathname: localizedHref(href.pathname, locale) };
  }
  return href;
}

export type LocaleLinkProps = Omit<LinkProps, "href"> &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof LinkProps> & {
    href: LinkUrl;
    children?: ReactNode;
  };

const LocaleLinkInner = forwardRef<HTMLAnchorElement, LocaleLinkProps>(function LocaleLink(
  { href, children, ...rest },
  ref
) {
  const locale = useLocale();
  return (
    <Link href={rewriteHref(href, locale)} ref={ref as Ref<HTMLAnchorElement>} {...rest}>
      {children}
    </Link>
  );
});

export default LocaleLinkInner;
