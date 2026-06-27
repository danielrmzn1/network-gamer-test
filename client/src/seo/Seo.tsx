import { Head } from 'vite-react-ssg'
import type { Lang } from '../i18n'
import { abs, DEFAULT_OG_IMAGE } from './config'

export interface Alternate {
  /** hreflang value, e.g. 'en', 'es', or 'x-default'. */
  hreflang: string
  /** root-relative path for that locale. */
  path: string
}

interface SeoProps {
  title: string
  description: string
  /** Canonical (and current) root-relative path, e.g. '/' or '/valorant-ping-test'. */
  path: string
  locale?: Lang
  /** Reciprocal hreflang set (include self + x-default). Omit on pages with one locale. */
  alternates?: Alternate[]
  /** Path or absolute URL of the share image. */
  image?: string
  type?: 'website' | 'article'
  /** One or more schema.org JSON-LD objects. */
  jsonLd?: object | object[]
}

const ogLocale = (l: Lang): string => (l === 'es' ? 'es_ES' : 'en_US')

/**
 * Per-route document head: title, meta description, canonical, Open Graph,
 * Twitter Card, hreflang alternates, and JSON-LD. Rendered into the prerendered
 * HTML at build time (vite-react-ssg + react-helmet-async), so crawlers, social
 * scrapers, and AI bots see it without executing JavaScript.
 */
export function Seo({
  title,
  description,
  path,
  locale = 'en',
  alternates,
  image = DEFAULT_OG_IMAGE,
  type = 'website',
  jsonLd,
}: SeoProps) {
  const url = abs(path)
  const img = image.startsWith('http') ? image : abs(image)
  const ld = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : []

  return (
    <Head>
      <html lang={locale} />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="FRAGRATE" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={img} />
      <meta property="og:locale" content={ogLocale(locale)} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={img} />

      {alternates?.map((a) => (
        <link key={a.hreflang} rel="alternate" hrefLang={a.hreflang} href={abs(a.path)} />
      ))}

      {ld.map((obj, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(obj)}
        </script>
      ))}
    </Head>
  )
}
