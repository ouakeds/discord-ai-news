import pino from 'pino';

// Convention: every ERROR-level call must include { source: 'module-name' }
// Example: logger.error({ source: 'rss-collector', url, err }, 'Fetch failed')
const logger = pino(
  process.env.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty' } }
    : {}
);

export default logger;
