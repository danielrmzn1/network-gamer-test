import type { Genre } from './catalog.types'

export interface LowerBand { great: number; good: number; ok: number; bad: number }
export interface HigherBand { good: number; ok: number }

export interface GenreBands {
  genre: Genre
  pingMs: LowerBand
  jitterMs: LowerBand
  lossPct: LowerBand
  downloadMbps: HigherBand
  uploadMbps: HigherBand
  note: string
}
