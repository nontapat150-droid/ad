import api from '../api/axios';

/**
 * Robustly resolve image URLs. 
 * Handles full HTTP URLs, absolute paths starting with /uploads, and plain filenames.
 */
export const getImageUrl = (img, defaultFolder = 'misc') => {
  if (!img || typeof img !== 'string' || img === 'รับหน้างาน') return '';
  
  const cleanImg = img.trim();
  if (cleanImg.startsWith('http')) return cleanImg;
  
  // Use backend's /api/uploads fallback to bypass strict Nginx static interception
  let base = api.defaults.baseURL || '';
  if (base.endsWith('/')) {
    base = base.slice(0, -1);
  }

  const filename = cleanImg.split('/').pop();
  
  // Auto-detect folder by prefix
  let folder = defaultFolder ? (defaultFolder.endsWith('/') ? defaultFolder : `${defaultFolder}/`) : '';
  if (filename.startsWith('profiles_')) folder = 'profiles/';
  else if (filename.startsWith('misc_')) folder = 'misc/';
  else if (filename.startsWith('checkins_')) folder = 'checkins/';
  else if (filename.startsWith('checkouts_')) folder = 'checkouts/';
  else if (filename.startsWith('oil_receipts_')) folder = 'oil_receipts/';
  
  return `${base}/uploads/${folder}${filename}`;
};
