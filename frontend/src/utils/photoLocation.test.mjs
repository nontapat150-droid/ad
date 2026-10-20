import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isThailandCoordinate, readImageGps, readJpegGps } from './photoLocation.js';

function writeExifGps(littleEndian = true) {
  const bytes = new Uint8Array(160);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, 0xffd8); // JPEG
  view.setUint16(2, 0xffe1);
  view.setUint16(4, 150);
  bytes.set([69, 120, 105, 102, 0, 0], 6); // Exif\0\0
  const tiff = 12;
  bytes.set(littleEndian ? [73, 73] : [77, 77], tiff);
  view.setUint16(tiff + 2, 42, littleEndian);
  view.setUint32(tiff + 4, 8, littleEndian);
  const ifd = tiff + 8;
  view.setUint16(ifd, 1, littleEndian);
  view.setUint16(ifd + 2, 0x8825, littleEndian);
  view.setUint16(ifd + 4, 4, littleEndian);
  view.setUint32(ifd + 6, 1, littleEndian);
  view.setUint32(ifd + 10, 26, littleEndian);
  const gps = tiff + 26;
  view.setUint16(gps, 4, littleEndian);
  const entry = (tag, type, count, value) => {
    view.setUint16(entry.offset, tag, littleEndian); view.setUint16(entry.offset + 2, type, littleEndian);
    view.setUint32(entry.offset + 4, count, littleEndian); view.setUint32(entry.offset + 8, value, littleEndian); entry.offset += 12;
  };
  entry.offset = gps + 2;
  entry(1, 2, 2, 'N'.charCodeAt(0)); entry(2, 5, 3, 80); entry(3, 2, 2, 'E'.charCodeAt(0)); entry(4, 5, 3, 104);
  [[13, 1], [45, 1], [0, 1], [100, 1], [30, 1], [0, 1]].forEach(([n, d], index) => { view.setUint32(tiff + 80 + index * 8, n, littleEndian); view.setUint32(tiff + 84 + index * 8, d, littleEndian); });
  return bytes.buffer;
}

test('reads GPS coordinates from a JPEG EXIF block', () => {
  assert.deepEqual(readJpegGps(writeExifGps()), { lat: 13.75, lng: 100.5 });
  assert.equal(readJpegGps(new Uint8Array([0xff, 0xd8]).buffer), null);
  assert.equal(isThailandCoordinate(13.75, 100.5), true);
  assert.equal(isThailandCoordinate(52.5, 13.4), false);
});

test('reads GPS coordinates from a big-endian JPEG EXIF block', () => {
  assert.deepEqual(readJpegGps(writeExifGps(false)), { lat: 13.75, lng: 100.5 });
});

function writePngExif() {
  const tiff = new Uint8Array(writeExifGps()).slice(12);
  const bytes = new Uint8Array(8 + 12 + tiff.length);
  const view = new DataView(bytes.buffer);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  view.setUint32(8, tiff.length, false);
  bytes.set([101, 88, 73, 102], 12); // eXIf
  bytes.set(tiff, 16);
  return bytes.buffer;
}

function writeWebpExif() {
  const tiff = new Uint8Array(writeExifGps()).slice(12);
  const padding = tiff.length % 2;
  const bytes = new Uint8Array(12 + 8 + tiff.length + padding);
  const view = new DataView(bytes.buffer);
  bytes.set([82, 73, 70, 70], 0); // RIFF
  view.setUint32(4, bytes.length - 8, true);
  bytes.set([87, 69, 66, 80, 69, 88, 73, 70], 8); // WEBP + EXIF
  view.setUint32(16, tiff.length, true);
  bytes.set(tiff, 20);
  return bytes.buffer;
}

test('reads GPS coordinates from PNG and WebP EXIF blocks', () => {
  const expected = { lat: 13.75, lng: 100.5 };
  assert.deepEqual(readImageGps(writePngExif()), expected);
  assert.deepEqual(readImageGps(writeWebpExif()), expected);
});
