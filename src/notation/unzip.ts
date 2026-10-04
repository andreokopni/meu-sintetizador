// Leitor mínimo de ZIP, suficiente para arquivos .mxl (MusicXML compactado).
// Suporta entradas armazenadas (método 0) e deflate (método 8, via DecompressionStream).

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export interface ZipEntry {
  name: string
  read(): Promise<Uint8Array>
}

export function listZip(buffer: ArrayBuffer): ZipEntry[] {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  // Fim do diretório central: assinatura 0x06054b50, procurada de trás para frente.
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('Arquivo .mxl inválido (não é um ZIP).')
  const count = view.getUint16(eocd + 10, true)
  let p = view.getUint32(eocd + 16, true)
  const entries: ZipEntry[] = []
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error('Arquivo .mxl corrompido.')
    const method = view.getUint16(p + 10, true)
    const compressedSize = view.getUint32(p + 20, true)
    const nameLen = view.getUint16(p + 28, true)
    const extraLen = view.getUint16(p + 30, true)
    const commentLen = view.getUint16(p + 32, true)
    const localOffset = view.getUint32(p + 42, true)
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen))
    entries.push({
      name,
      read: async () => {
        const localNameLen = view.getUint16(localOffset + 26, true)
        const localExtraLen = view.getUint16(localOffset + 28, true)
        const start = localOffset + 30 + localNameLen + localExtraLen
        const data = bytes.subarray(start, start + compressedSize)
        if (method === 0) return data
        if (method === 8) return inflateRaw(data)
        throw new Error(`Compressão ZIP não suportada (método ${method}).`)
      },
    })
    p += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

/** Extrai o MusicXML principal de um .mxl (segue META-INF/container.xml quando existe). */
export async function readMxl(buffer: ArrayBuffer): Promise<string> {
  const entries = listZip(buffer)
  const decode = async (e: ZipEntry) => new TextDecoder().decode(await e.read())
  let target: ZipEntry | undefined
  const container = entries.find((e) => e.name === 'META-INF/container.xml')
  if (container) {
    const path = /full-path="([^"]+)"/.exec(await decode(container))?.[1]
    target = entries.find((e) => e.name === path)
  }
  target ??= entries.find((e) => !e.name.startsWith('META-INF/') && /\.(xml|musicxml)$/i.test(e.name))
  if (!target) throw new Error('Nenhuma partitura encontrada dentro do .mxl.')
  return decode(target)
}
