import { drawCheckinWatermark } from './checkinWatermark';

function loadFileImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
    };
    image.src = url;
  });
}

function toBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('ไม่สามารถสร้างรูปพร้อมข้อมูลตำแหน่งได้')), 'image/jpeg', 0.9);
  });
}

/** Adds the site's location bar to the saved copy while preserving the original on the user's device. */
export async function createSalesLocationPhoto(file, { lat, lng, address, siteName, logoImg }) {
  const image = await loadFileImage(file);
  const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const ratio = largestSide > 2560 ? 2560 / largestSide : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * ratio));
  const height = Math.max(1, Math.round(image.naturalHeight * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0, width, height);
  drawCheckinWatermark(context, { width, height, lat, lng, address, siteName, logoImg });
  const blob = await toBlob(canvas);
  const filename = `${file.name.replace(/\.[^.]+$/, '') || 'front-of-house'}-location.jpg`;
  return new File([blob], filename, { type: 'image/jpeg', lastModified: Date.now() });
}
