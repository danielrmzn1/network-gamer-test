// Canonical site origin for absolute canonical / Open Graph / hreflang URLs.
// Override at build time with VITE_SITE_URL once the custom domain is connected
// (e.g. VITE_SITE_URL=https://fragrate.gg). The placeholder below MUST match the
// origin used in public/robots.txt and public/sitemap.xml.
export const SITE_URL = (import.meta.env.VITE_SITE_URL ?? 'https://fragrate.gg').replace(/\/+$/, '')

/** Resolve a root-relative path to an absolute URL on the canonical origin. */
export const abs = (path: string): string => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`

/** Default Open Graph / Twitter share image (1200x630 recommended). */
export const DEFAULT_OG_IMAGE = '/og.png'

/** Locales the site publishes, in hreflang order. */
export const LOCALES = ['en', 'es'] as const
