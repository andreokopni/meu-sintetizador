import type { Track } from '../model/project'

/** Uma faixa soa se não está muda e, havendo alguma faixa em solo, se ela também está em solo. */
export function isTrackAudible(track: Track, tracks: Track[]): boolean {
  if (track.mute) return false
  const anySolo = tracks.some((t) => t.solo)
  return !anySolo || track.solo
}

/** Volume linear (0..1) para decibéis. */
export function volumeToDb(volume: number): number {
  return volume <= 0 ? -Infinity : 20 * Math.log10(volume)
}
