/** Build URL for check-in / check-out upload images */
export function getCheckinImageUrl(filename, type = 'checkin') {
  if (!filename || filename === 'null' || filename === 'undefined') return null;
  if (filename.startsWith('http')) return filename;

  let cleanName = filename;
  if (cleanName.includes('/')) cleanName = cleanName.split('/').pop();
  if (cleanName.includes('\\')) cleanName = cleanName.split('\\').pop();

  const baseUrl = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
    : '/api';

  if (cleanName.startsWith('checkouts_')) return `${baseUrl}/uploads/checkouts/${cleanName}`;
  if (cleanName.startsWith('checkins_')) return `${baseUrl}/uploads/checkins/${cleanName}`;
  return type === 'checkout'
    ? `${baseUrl}/uploads/checkouts/${cleanName}`
    : `${baseUrl}/uploads/checkins/${cleanName}`;
}

export function handleUploadImageError(e) {
  if (!e.target.dataset.retried) {
    e.target.dataset.retried = 'true';
    if (e.target.src.includes('/api/uploads/')) {
      e.target.src = e.target.src.replace('/api/uploads/', '/uploads/');
    } else if (e.target.src.includes('/uploads/')) {
      e.target.src = e.target.src.replace('/uploads/', '/api/uploads/');
    }
  }
}
