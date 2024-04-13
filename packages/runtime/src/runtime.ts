import {
  createIntersectionObserver,
  createSelectorQuery,
  getSystemInfoSync
} from './wx';

const wx = {
  getSystemInfoSync,
  createSelectorQuery,
  createIntersectionObserver
};

const getApp = () => {
  return window;
};

export default {
  wx,
  getApp
};
