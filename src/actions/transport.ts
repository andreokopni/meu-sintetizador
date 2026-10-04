import { engine } from '../audio/engine'
import { projectLengthBeats } from '../model/project'
import { useProjectStore } from '../store/useProjectStore'

let endWatcher = 0

export async function startPlayback() {
  const { playStart, loop, setPlaying } = useProjectStore.getState()
  await engine.play(playStart, loop)
  setPlaying(true)
  watchEnd()
}

/** Para e volta o cursor para o ponto de início (como na maioria das DAWs). */
export function stopPlayback() {
  engine.stop()
  engine.seek(useProjectStore.getState().playStart)
  useProjectStore.getState().setPlaying(false)
  cancelAnimationFrame(endWatcher)
}

export function togglePlayback() {
  if (useProjectStore.getState().isPlaying) stopPlayback()
  else startPlayback()
}

export function setLoop(loop: boolean) {
  useProjectStore.getState().setLoop(loop)
  engine.setLoop(loop)
}

export function setPlayStart(beat: number) {
  useProjectStore.getState().setPlayStart(beat)
  engine.seek(Math.max(0, beat))
}

/** Sem loop, para sozinho ao chegar ao fim da música. */
function watchEnd() {
  cancelAnimationFrame(endWatcher)
  const tick = () => {
    const { isPlaying, loop, project } = useProjectStore.getState()
    if (!isPlaying) return
    if (!loop && engine.getPositionBeats() >= projectLengthBeats(project)) {
      stopPlayback()
      return
    }
    endWatcher = requestAnimationFrame(tick)
  }
  endWatcher = requestAnimationFrame(tick)
}
