'use strict';

const colors = {
  reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m',
  yellow: '\x1b[33m', blue: '\x1b[34m', gray: '\x1b[90m',
};

const timestamp = () => new Date().toISOString().replace('T', ' ').substring(0, 19);

const logger = {
  info:  (...args) => console.log(`${colors.green}[INFO]${colors.reset}  ${colors.gray}${timestamp()}${colors.reset}`, ...args),
  warn:  (...args) => console.warn(`${colors.yellow}[WARN]${colors.reset}  ${colors.gray}${timestamp()}${colors.reset}`, ...args),
  error: (...args) => console.error(`${colors.red}[ERROR]${colors.reset} ${colors.gray}${timestamp()}${colors.reset}`, ...args),
  debug: (...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`${colors.blue}[DEBUG]${colors.reset} ${colors.gray}${timestamp()}${colors.reset}`, ...args);
    }
  },
};

module.exports = logger;
