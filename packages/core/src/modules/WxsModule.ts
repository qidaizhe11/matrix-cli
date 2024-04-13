import { ChildNode, isText } from 'domhandler';
import path from 'path';
import BaseModule from './BaseModule';

export type WxsType = 'copy' | 'plain';

export default class WxsModule {
  /**
   * wxs 类型，copy: 外部引用 wxs；plain: 内嵌型 wxs
   */
  type: WxsType;

  /**
   * wxs name
   */
  name: string;

  /**
   * 相对于 entry 的相对路径
   */
  basePath: string;

  /**
   * 文件绝对路径
   */
  sourcePath: string;

  /**
   * wxs import source
   */
  importUrl: string;

  /**
   * h5 转换后的 import source
   */
  importUrlH5: string;

  /**
   * template 内子节点列表，内嵌型 wxs 专用
   */
  children?: ChildNode[];

  /**
   * wxs 内容，内嵌型 wxs 专用
   */
  content?: string;

  constructor(
    baseModule: BaseModule,
    name: string,
    importUrl: string,
    children: ChildNode[]
  ) {
    this.name = name;
    this.children = children;
    this.type = importUrl ? 'copy' : 'plain';
    this.importUrl = importUrl || `./${name}.wxs`;

    this.sourcePath = path.resolve(baseModule.absPath, '../', this.importUrl);

    this.basePath = path.relative(baseModule.entry, this.sourcePath);

    this.importUrlH5 = this.importUrl;
    if (this.importUrlH5.startsWith('/miniprogram_npm/')) {
      this.importUrlH5 = this.importUrlH5.replace('/miniprogram_npm/', '');
    }

    this.content = '';
    if (this.type === 'plain' && this.children[0] && isText(this.children[0])) {
      this.content = this.children[0].data;
    }
  }
}
