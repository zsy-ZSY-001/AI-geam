import winston from 'winston';
import { ElasticsearchTransport } from 'winston-elasticsearch';

const { combine, timestamp, json, colorize, printf } = winston.format;

const consoleFormat = printf(({ level, message, timestamp, ...metadata }) => {
  return `${timestamp} ${level}: ${message} ${Object.keys(metadata).length ? JSON.stringify(metadata, null, 2) : ''}`;
});

const options = {
  console: {
    level: process.env.LOG_LEVEL || 'debug',
    handleExceptions: true,
    format: combine(
      colorize(),
      timestamp(),
      consoleFormat
    )
  },
  file: {
    level: 'info',
    filename: './logs/app.log',
    handleExceptions: true,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    format: combine(
      timestamp(),
      json()
    )
  },
  elasticsearch: {
    level: 'info',
    clientOpts: {
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
      log: 'info'
    },
    indexPrefix: 'aigeam-logs'
  }
};

const logger = winston.createLogger({
  levels: winston.config.npm.levels,
  transports: [
    new winston.transports.Console(options.console),
    new winston.transports.File(options.file)
  ],
  exitOnError: false
});

// 只在生产环境添加Elasticsearch传输
if (process.env.NODE_ENV === 'production') {
  logger.add(new ElasticsearchTransport(options.elasticsearch));
}

export class Logger {
  static info(message: string, metadata: object = {}) {
    logger.info(message, metadata);
  }

  static error(message: string, error?: Error, metadata: object = {}) {
    logger.error(message, { ...metadata, error: error?.stack });
  }

  static warn(message: string, metadata: object = {}) {
    logger.warn(message, metadata);
  }

  static debug(message: string, metadata: object = {}) {
    logger.debug(message, metadata);
  }

  static http(message: string, metadata: object = {}) {
    logger.http(message, metadata);
  }
} 