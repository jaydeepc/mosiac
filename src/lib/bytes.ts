/** Mongo returns Binary/Buffer; Response wants a plain ArrayBuffer-backed body. */
export function toBody(data: Buffer | Uint8Array | { buffer: ArrayBufferLike }): ArrayBuffer {
  const u8 = data instanceof Uint8Array ? data : new Uint8Array((data as { buffer: ArrayBufferLike }).buffer as ArrayBuffer);
  const out = new ArrayBuffer(u8.byteLength);
  new Uint8Array(out).set(u8);
  return out;
}
