// Preferências de interface por usuário (zoom, tamanhos de painel). Guardadas no
// localStorage, que pode falhar (modo privado etc.) — por isso tudo em try/catch.

export function loadNumber(key: string, fallback: number): number {
  try {
    const v = Number(localStorage.getItem(`msynth.${key}`))
    return Number.isFinite(v) && v > 0 ? v : fallback
  } catch {
    return fallback
  }
}

export function saveNumber(key: string, value: number) {
  try {
    localStorage.setItem(`msynth.${key}`, String(value))
  } catch {
    // ignora
  }
}
