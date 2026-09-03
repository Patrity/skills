const SNIFF_BYTES = 8000

export function isBinary(bytes: Uint8Array): boolean {
  const end = Math.min(bytes.byteLength, SNIFF_BYTES)
  for (let i = 0; i < end; i++) {
    if (bytes[i] === 0) return true
  }
  return false
}
