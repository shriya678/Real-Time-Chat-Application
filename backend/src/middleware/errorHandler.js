import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const code = err.code || (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
  const message =
    err.publicMessage || (status < 500 ? err.message : 'Something went wrong');

  logger.error(`${req.method} ${req.originalUrl} -> ${status}`, {
    message: err.message,
    stack: env.IS_PRODUCTION ? undefined : err.stack,
  });

  res.status(status).json({
    success: false,
    error: { code, message },
  });
}

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
