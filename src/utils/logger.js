const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure log directory exists
const logDir = path.join(process.cwd(), 'z_Logs and traces');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info', // Overall logger level
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      return `${timestamp} [${level.toUpperCase()}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
    })
  ),
  transports: [
    // File transport - ERROR level only to keep file small
    new winston.transports.File({ 
      filename: path.join(logDir, 'app.log'),
      level: 'error', // ✅ Only log errors to file
      maxsize: 10485760, // 10MB
      maxFiles: 10
    }),
    // Console transport - INFO level for debugging
    new winston.transports.Console({
      level: 'info', // Keep console verbose for development
      format: winston.format.colorize({ all: true })
    })
  ]
});

module.exports = logger;

