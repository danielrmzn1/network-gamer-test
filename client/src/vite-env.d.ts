/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Canonical site origin used for canonical/OG/hreflang URLs, e.g. https://fragrate.gg. */
  readonly VITE_SITE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
