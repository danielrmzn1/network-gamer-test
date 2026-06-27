import type { EngineState } from '../../state/store'
import type { Region } from '@shared/catalog.types'
import type { Lang } from '../../i18n'

export interface MobileRegionsProps {
  s: EngineState
  lang: Lang
  onPickRegion: (r: Region) => void
}

export function MobileRegions(_props: MobileRegionsProps) {
  return <div data-tab="regions" />
}
