import path from 'path';

export const MAYBE_NPM_PATH = /^[@\w](?:[^:]|$)/

/**
 * 根据 wxml 路径获取同组件其他文件 (ext, 如 wxss) 路径
 * @param wxmlAbsPath wxml 文件路径
 * @param ext 其他文件 ext，如 wxss
 * @returns 其他文件路径
 */
export function getPath(wxmlAbsPath: string, ext: string) {
  const extPath = wxmlAbsPath.replace(/\.wxml$/, ext);
  return extPath;
}

/**
 * npm 路径判断
 * @param path 文件路径
 * @returns 是否 npm 包路径
 */
export function maybeNpmPath(path) {
  return typeof path === 'string' && MAYBE_NPM_PATH.test(path)
}

export const normalizePath = path.normalize

export const lowerCase = (str) => str.toLowerCase()

export const lowerCaseNormalizePath = (str) => lowerCase(normalizePath(str))

export function changeExtname(absPath: string, extname: string) {
  return path.join(
    path.dirname(absPath),
    path.basename(absPath, path.extname(absPath)) + extname
  );
}
