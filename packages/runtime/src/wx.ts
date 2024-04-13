import { LocalIntersectionObserver } from './intersectionObserver';
import { SelectorQuery } from './selectorQuery';

/** 获取窗口信息 */
export const getWindowInfo = () => {
  const info = {
    /** 设备像素比 */
    pixelRatio: window.devicePixelRatio,
    /** 屏幕宽度，单位px */
    screenWidth: window.screen.width,
    /** 屏幕高度，单位px */
    screenHeight: window.screen.height,
    /** 可使用窗口宽度，单位px */
    windowWidth: document.documentElement.clientWidth,
    /** 可使用窗口高度，单位px */
    windowHeight: document.documentElement.clientHeight,
    /** 状态栏的高度，单位px */
    statusBarHeight: NaN,
    /** 在竖屏正方向下的安全区域 */
    safeArea: {
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      top: 0,
      width: 0
    }
  };

  return info;
};

/** 获取设备设置 */
export const getSystemInfoSync = () => {
  const windowInfo = getWindowInfo();

  const info = {
    ...windowInfo
  };

  return info;
};

export const createSelectorQuery = () => {
  return new SelectorQuery(null);
};

export const createIntersectionObserver = (component, options) => {
  return new LocalIntersectionObserver(component, options);
};
