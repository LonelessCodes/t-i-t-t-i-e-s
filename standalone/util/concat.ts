export function concatUint8Arrays(
  arrays: Uint8Array[],
): Uint8Array {
  const totalLength = arrays.reduce((acc, array) => acc + array.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const array of arrays) {
    result.set(array, offset);
    offset += array.byteLength;
  }
  return result;
}
