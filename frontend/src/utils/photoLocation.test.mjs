import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isThailandCoordinate, readJpegGps } from './photoLocation.js';

function writeExifGps() {
  const bytes = new Uint8Array(160);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, 0xffd8); // JPEG
  view.setUint16(2, 0xffe1);
  view.setUint16(4, 150);
  bytes.set([69, 120, 105, 102, 0, 0], 6); // Exif\0\0
  const tiff = 12;
  bytes.set([73, 73], tiff); // little endian
  view.setUint16(tiff + 2, 42, true);
  view.setUint32(tiff + 4, 8, true);
  const ifd = tiff + 8;
  view.setUint16(ifd, 1, true);
  view.setUint16(ifd + 2, 0x8825, true);
  view.setUint16(ifd + 4, 4, true);
  view.setUint32(ifd + 6, 1, true);
  view.setUint32(ifd + 10, 26, true);
  const gps = tiff + 26;
  view.setUint16(gps, 4, true);
  const entry = (tag, type, count, value) => {
    view.setUint16(entry.offset, tag, true); view.setUint16(entry.offset + 2, type, true);
    view.setUint32(entry.offset + 4, count, true); view.setUint32(entry.offset + 8, value, true); entry.offset += 12;
  };
  entry.offset = gps + 2;
  entry(1, 2, 2, 'N'.charCodeAt(0)); entry(2, 5, 3, 80); entry(3, 2, 2, 'E'.charCodeAt(0)); entry(4, 5, 3, 104);
  [[13, 1], [45, 1], [0, 1], [100, 1], [30, 1], [0, 1]].forEach(([n, d], index) => { view.setUint32(tiff + 80 + index * 8, n, true); view.setUint32(tiff + 84 + index * 8, d, true); });
  return bytes.buffer;
}

test('reads GPS coordinates from a JPEG EXIF block', () => {
  assert.deepEqual(readJpegGps(writeExifGps()), { lat: 13.75, lng: 100.5 });
  assert.equal(readJpegGps(new Uint8Array([0xff, 0xd8]).buffer), null);
  assert.equal(isThailandCoordinate(13.75, 100.5), true);
  assert.equal(isThailandCoordinate(52.5, 13.4), false);
});
