import winston from './winston';

export interface Log {
  status: 'error' | 'warn' | 'info' | 'success' | 'debug';
  message: string;
}

let logs: Log[] = [];

export const logger = {
  error: function (message) {
    logs.push({
      status: 'error',
      message
    });
    winston.error(message);
  },
  warn: function (message) {
    logs.push({
      status: 'warn',
      message
    });
    winston.warn(message);
  },
  info: function (message) {
    logs.push({
      status: 'info',
      message
    });
    winston.info(message);
  },
  success: function (message) {
    logs.push({
      status: 'success',
      message
    });
    winston.verbose(message);
  },
  debug: function (message, flag, name, value) {
    if (typeof name !== 'string') {
      value = name;
      name = 'params';
    }
    let msg = message;
    flag && (msg += ` ${flag}`);
    name && (msg += ` ${name}`);
    value && (msg += `=${value ? JSON.stringify(value) : value}`);
    logs.push({
      status: 'debug',
      message: msg
    });
    winston.debug(msg);
  },
  ENTRY: '>>>>>',
  EXIT: '<<<<<'
};

export const initLogger = () => {
  logs = [];
};

export const getLogs = () => {
  return logs;
};
