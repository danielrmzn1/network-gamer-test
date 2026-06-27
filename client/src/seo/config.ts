// Canonical site origin for absolute canonical / Open Graph / hreflang URLs.
// Defaults to the production domain; override at build time with VITE_SITE_URL
// only if the domain changes. Keep in sync with public/robots.txt and the
// gen-sitemap.mjs fallback.
export const SITE_URL = (import.meta.env.VITE_SITE_URL ?? 'https://fragrate.daniel-ramirez.dev').replace(/\/+$/, '')

/** Resolve a root-relative path to an absolute URL on the canonical origin. */
export const abs = (path: string): string => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`

/** Default Open Graph / Twitter share image (1200x630 recommended). */
export const DEFAULT_OG_IMAGE = '/og.png'

/** Locales the site publishes, in hreflang order. */
export const LOCALES = ['en', 'es'] as const
