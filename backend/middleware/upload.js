const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
require('dotenv').config();

const UPLOAD_DIR     = process.env.UPLOAD_DIR || 'uploads';
const MAX_SIZE_BYTES = (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024;

// ── Allowed MIME types ─────────────────────────────────────
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// ── Storage engine (disk, organised by sub-folder) ─────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const subdir = req.uploadSubdir || 'misc';
    const dir    = path.join(__dirname, '..', UPLOAD_DIR, subdir);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext      = path.extname(file.originalname).toLowerCase();
    const userId   = req.user?.id || 'anon';
    const ts       = Date.now();
    const rand     = Math.random().toString(36).slice(2, 8);
    cb(null, `${subdir(req)}_${userId}_${ts}_${rand}${ext}`);
  },
});

function subdir(req) {
  return req.uploadSubdir || 'misc';
}

// ── File filter ────────────────────────────────────────────
const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`), false);
  }
};

// ── Multer instance ────────────────────────────────────────
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_BYTES },
});

/**
 * Middleware factory — sets sub-directory and returns multer handler.
 * Usage: router.post('/checkin', setUpload('checkins'), upload.single('image'), handler)
 */
const setUpload = (subDirName) => (req, res, next) => {
  req.uploadSubdir = subDirName;
  next();
};

module.exports = { upload, setUpload };
