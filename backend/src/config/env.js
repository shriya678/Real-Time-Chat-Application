import 'dotenv/config';

const REQUIRED = ['PORT', 'MONGODB_URI', 'CORS_ORIGIN'];

const raw = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT,
  MONGODB_URI: process.env.MONGODB_URI,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};

const missing = REQUIRED.filter((k) => !raw[k] || String(raw[k]).trim() === '');
if (missing.length) {
  console.error(`[config] Missing required env vars: ${missing.join(', ')}`);
  console.error('[config] See backend/.env.example for the full list.');
  process.exit(1);
}

export const env = Object.freeze({
  NODE_ENV: raw.NODE_ENV,
  PORT: Number(raw.PORT),
  MONGODB_URI: raw.MONGODB_URI,
  CORS_ORIGIN: raw.CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean),
  LOG_LEVEL: raw.LOG_LEVEL,
  IS_PRODUCTION: raw.NODE_ENV === 'production',
});
