/**
 * 会被沙盒化的变量名称
 */
export const SCOPED_IDENTIFIERS = [
  'getApp',
  'getCurrentPages',
  'wx',
  'global',
];

/**
 * 沙箱变量名称
 */
export const SCOPED_ENV_NAME = '_$_';

/**
 * 用以匹配 css 中 @import
 */
export const CSS_IMPORT_REGEXP = /@import\s+(['"])([^'"]+)\1/g;

export const CSS_IMPORT_LINE_REGEXP = /@import\s+(['"])([^'"]+)\1;/g;
