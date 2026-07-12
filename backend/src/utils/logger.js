const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const threshold = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

const timestamp = () => new Date().toISOString();

const format = (level, message, meta) => {
  const base = `[${timestamp()}] [${level}] ${message}`;
  return meta && Object.keys(meta).length ? `${base} ${JSON.stringify(meta)}` : base;
};

export const logger = {
  error(message, meta) {
    if (threshold >= LEVELS.error) console.error(format('error', message, meta));
  },
  warn(message, meta) {
    if (threshold >= LEVELS.warn) console.warn(format('warn', message, meta));
  },
  info(message, meta) {
    if (threshold >= LEVELS.info) console.log(format('info', message, meta));
  },
  debug(message, meta) {
    if (threshold >= LEVELS.debug) console.debug(format('debug', message, meta));
  },
};
