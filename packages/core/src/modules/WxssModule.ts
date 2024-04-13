import { changeExtname } from '@matrix/utils';
import path from 'path';
import BaseModule from './BaseModule';

export default class WxssModule {
  /**
   * wxss name
   */
  name: string;

  /**
   * 相对于 entry 的相对路径
   */
  absPath: string;

  /**
   * wxss import source
   */
  importUrl: string;

  /**
   * 文件内容
   */
  content: string;

  constructor(
    baseModule: BaseModule,
    name: string,
    absPath: string,
    importUrl: string,
    content: string
  ) {
    this.name = name;
    this.absPath = absPath;

    this.importUrl =
      importUrl ||
      changeExtname(
        path.relative(path.resolve(baseModule.absPath, '..'), this.absPath),
        '.css.js'
      );

    this.content = content;
  }
}
