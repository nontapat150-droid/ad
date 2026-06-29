import api from '../api/axios';

/**
 * Robustly resolve image URLs. 
 * Handles full HTTP URLs, absolute paths starting with /uploads, and plain filenames.
 */
export const getImageUrl = (img, folder = 'misc') => {
  if (!img || typeof img !== 'string') return '';
  
  const cleanImg = img.trim();
  if (cleanImg.startsWith('http')) return cleanImg;
  
  // Use backend's /api/uploads fallback to bypass strict Nginx static interception
  // which might be pointing to a stale directory for newly uploaded files.
  
  let base = api.defaults.baseURL || '';
  // Ensure we don't end up with double slashes
  if (base.endsWith('/')) {
    base = base.slice(0, -1);
  }

  // If the path already has 'uploads/', split and append
  if (cleanImg.includes('uploads/')) {
    const parts = cleanImg.split('uploads/');
    const filename = parts[1].replace(/^\/+/, '');
    return `${base}/uploads/${filename}`;
  }
  
  // Standard case
  const filename = cleanImg.replace(/^\/+/, '');
  return `${base}/uploads/${folder}/${filename}`;
};
