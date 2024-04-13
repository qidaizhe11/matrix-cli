import chalk from 'chalk';
import { createLogger, format, transports } from 'winston';

const { combine, timestamp, label, printf } = format;
const customFormat = printf(({ level, message, label, timestamp }) => {
  let feature = '';
  if (/^\[(.*?)\]/.test(message)) {
    const matches = message.match(/\[(.*?)\]/);
    matches && (feature = `[${matches[1]}]`);
    message = message.replace(/\[(.*?)\]\s*/, '');
    return color(level, `${toUpperCase(level)} ${feature} ${message}`);
  }
  return `${toUpperCase(level)} ${message}`;
});

const winstonLogger = createLogger({
  level: 'debug',
  format: combine(
    // label({ label: '' }),
    timestamp(),
    customFormat
  ),
  // transports: {
  //   console: new transports.Console({ level: 'warn' }),
  //   file: new transports.File({ filename: process.cwd() + 'wm-cloud-matrix-debug.log', level: 'error' })
  // }
  transports: [new transports.Console()]
});

// exceptions.handle(
//   new transports.File({ filename: process.cwd() + 'wm-cloud-matrix-exceptions.log' })
// );

// transports.console.level = 'info';
// transports.file.level = 'info';
winstonLogger.exitOnError = false;

const chalkMap = {
  error: chalk.bold.red, // 0 错误
  warn: chalk.hex('#FFA500'), // 1 警告，可能出错
  info: chalk.blueBright, // 2 重要流程
  verbose: chalk.greenBright, // 4 成功
  debug: chalk.blueBright // 5 普通日志
};

function color(level = 'info', message) {
  const fn = chalkMap[level];
  if (!fn) return '';
  return fn(message);
}

const levelMap = {
  error: 'fail',
  verbose: 'success',
  warn: 'warning',
  info: 'main'
  // debug: 'log'
};

function toUpperCase(level) {
  level = levelMap[level] || level;
  return chalk.bgBlackBright(level.toUpperCase());
}

function formatTime(timestamp) {
  return chalk.blackBright(timestamp.replace(/T/, ' ').replace(/\.\d+Z/, ''));
}

export default winstonLogger;
