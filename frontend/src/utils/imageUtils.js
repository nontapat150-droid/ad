import api from '../api/axios';

/**
 * Robustly resolve image URLs. 
 * Handles full HTTP URLs, absolute paths starting with /uploads, and plain filenames.
 */
export const getImageUrl = (img, folder = 'misc') => {
  if (!img || typeof img !== 'string') return '';
  
  const cleanImg = img.trim();
  if (cleanImg.startsWith('http')) return cleanImg;
  
  // If it already contains 'uploads/', strip everything before 'uploads/' and ensure leading slash
  if (cleanImg.includes('uploads/')) {
    const parts = cleanImg.split('uploads/');
    return `${api.defaults.baseURL.replace('/api', '')}/uploads/${parts[1]}`;
  }
  
  // Standard case: just a filename
  // Clean up any accidental leading slashes on the filename itself
  const filename = cleanImg.replace(/^\/+/, '');
  return `${api.defaults.baseURL.replace('/api', '')}/uploads/${folder}/${filename}`;
};
