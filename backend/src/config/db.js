import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const READY_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

export async function connectDB() {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 8000,
    });
    logger.info('mongo connected');
  } catch (err) {
    logger.error('mongo initial connection failed', { message: err.message });
  }

  mongoose.connection.on('disconnected', () => {
    logger.warn('mongo disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('mongo reconnected');
  });

  mongoose.connection.on('error', (err) => {
    logger.error('mongo connection error', { message: err.message });
  });
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function getDbStatus() {
  return READY_STATES[mongoose.connection.readyState] || 'unknown';
}
