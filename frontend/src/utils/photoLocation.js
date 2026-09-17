/** Read GPS from the EXIF block of a JPEG without sending the photo anywhere. */
export function readJpegGps(buffer) {
  try {
    const view = new DataView(buffer);
    if (view.byteLength < 14 || view.getUint16(0) !== 0xffd8) return null;
    let offset = 2;
    while (offset + 4 <= view.byteLength) {
      if (view.getUint8(offset) !== 0xff) break;
      const marker = view.getUint8(offset + 1);
      const size = view.getUint16(offset + 2);
      if (size < 2 || offset + 2 + size > view.byteLength) break;
      if (marker === 0xe1 && offset + 10 < view.byteLength &&
          String.fromCharCode(...new Uint8Array(buffer, offset + 4, 4)) === 'Exif') {
        return readExifGps(view, offset + 10, offset + 2 + size);
      }
      offset += size + 2;
    }
  } catch {
    return null;
  }
  return null;
}

function readExifGps(view, tiff, end) {
  if (tiff + 8 > end) return null;
  const order = String.fromCharCode(view.getUint8(tiff), view.getUint8(tiff + 1));
  const little = order === 'II';
  if (!little && order !== 'MM') return null;
  const u16 = at => view.getUint16(at, little);
  const u32 = at => view.getUint32(at, little);
  if (u16(tiff + 2) !== 42) return null;
  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > end) return null;
  const count = u16(ifd);
  let gpsOffset = null;
  for (let index = 0; index < count; index += 1) {
    const entry = ifd + 2 + index * 12;
    if (entry + 12 > end) return null;
    if (u16(entry) === 0x8825) gpsOffset = tiff + u32(entry + 8);
  }
  if (!gpsOffset || gpsOffset + 2 > end) return null;
  const gpsCount = u16(gpsOffset);
  const values = {};
  for (let index = 0; index < gpsCount; index += 1) {
    const entry = gpsOffset + 2 + index * 12;
    if (entry + 12 > end) return null;
    const tag = u16(entry);
    const type = u16(entry + 2);
    const countValue = u32(entry + 4);
    const valueAt = tiff + u32(entry + 8);
    if ((tag === 1 || tag === 3) && type === 2 && countValue > 0) {
      values[tag] = String.fromCharCode(view.getUint8(entry + 8));
    }
    if ((tag === 2 || tag === 4) && type === 5 && countValue === 3 && valueAt + 24 <= end) {
      const parts = [0, 1, 2].map(i => {
        const numerator = u32(valueAt + i * 8);
        const denominator = u32(valueAt + i * 8 + 4);
        return denominator ? numerator / denominator : NaN;
      });
      values[tag] = parts.every(Number.isFinite) ? parts[0] + parts[1] / 60 + parts[2] / 3600 : NaN;
    }
  }
  if (!Number.isFinite(values[2]) || !Number.isFinite(values[4])) return null;
  const lat = values[1] === 'S' ? -values[2] : values[2];
  const lng = values[3] === 'W' ? -values[4] : values[4];
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

export async function readPhotoGps(file) {
  if (!file || file.type !== 'image/jpeg') return null;
  return readJpegGps(await file.arrayBuffer());
}

export function isThailandCoordinate(lat, lng) {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) &&
    Number(lat) >= 5 && Number(lat) <= 21 && Number(lng) >= 97 && Number(lng) <= 106.5;
}
