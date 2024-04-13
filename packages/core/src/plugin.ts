import type { Compiler } from './compiler';

/**
 * 插件接口定义
 */
export interface Plugin {
  /**
   * 插件名称
   */
  name: string;

  /**
   * Compiler 插件逻辑
   * @param compiler
   * @returns
   */
  apply: (compiler: Compiler) => void;
}
