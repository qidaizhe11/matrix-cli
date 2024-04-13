import { strike2camelCase } from '@matrix/utils';
import path from 'path';
import { TemplateNode } from '../templateHooks';
import BaseModule from './BaseModule';

export default class WxmlTemplateModule {
  /**
   * 小程序 name
   */
  name: string;

  /**
   * 文件绝对路径
   */
  absPath: string;

  /**
   * jsx name
   */
  componentName: string;

  /**
   * jsx import source
   */
  importUrl: string;

  /**
   * template 内子节点列表
   */
  children: TemplateNode[];

  constructor(baseModule: BaseModule, name: string, children: TemplateNode[]) {
    this.name = name;
    this.children = children;

    this.componentName = strike2camelCase(name) + 'Template';

    this.importUrl = `./${this.componentName}.tsx`;

    this.absPath = path.resolve(baseModule.absPath, '../', this.importUrl);
  }
}
