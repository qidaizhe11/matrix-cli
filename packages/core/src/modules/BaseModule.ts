import pathLib from 'path';

export type H5Components = Record<
  string,
  {
    tag: string;
    src: string;
    rawTag?: string;
    props?: Record<string, any>;
    defaultExport?: boolean;
  }
>;

export interface JsonConfig {
  component: boolean;

  usingComponents: Record<string, string>;

  h5Components?: H5Components;

  styleIsolation?: 'isolated' | 'apply-shared' | 'shared';
}

export type ModuleType = 'Component' | 'Page';

interface ModuleOptions {
  /**
   * 组件/页面名
   */
  name: string;

  /**
   * 文件类型，Component | Page
   */
  type: ModuleType;

  /**
   * 入口文件
   */
  entry: string;

  /**
   * 组件/页面文件绝对路径
   */
  absPath: string;

  /**
   * wxjs文件绝对路径
   */
  jsPath: string;

  /**
   * json文件绝对路径
   */
  jsonPath: string;

  /**
   * json文件内容
   */
  jsonConfig: JsonConfig;

  /**
   * wxss文件绝对路径
   */
  wxssPath: string;

  /**
   * wxs文件绝对路径
   */
  wxsPathList: string[];
}

interface ModuleIncludeComponent {
  /**
   * 引用来源，如 titan-h5-react
   */
  from: string;

  /**
   * 组件重命名，如 TiButton
   */
  rename?: string;

  /**
   * 组件名称 as 重命名，如 Input as MyInput
   */
  namedAs?: string;

  /**
   * 是否默认导出
   */
  defaultExport?: boolean;
}

class BaseModule {
  /**
   * 组件/页面名
   */
  name: string;

  /**
   * 文件类型，Component | Page
   */
  type: ModuleType;

  /**
   * 入口文件
   */
  entry: string;

  /**
   * 组件/页面入口 wxml 文件绝对路径
   */
  absPath: string;

  /**
   * 组件/页面目录名称
   */
  basePath: string;

  /**
   * wxjs文件绝对路径
   */
  jsPath: string;

  /**
   * json文件绝对路径
   */
  jsonPath: string;

  /**
   * json文件内容
   */
  jsonConfig: JsonConfig;

  /**
   * wxss文件绝对路径
   */
  wxssPath: string;

  /**
   * wxs文件绝对路径
   */
  wxsPathList: string[];

  /**
   * 模块 usingComponents 三方依赖收集
   * key: name
   */
  includeComponentsMap: Map<string, ModuleIncludeComponent>;

  /**
   * 引用方收集
   */
  issuer: BaseModule[];

  /**
   * 是否启用样式隔离，默认 true
   */
  enableStyleIsolation: boolean;

  constructor(options: ModuleOptions) {
    this.name = options.name;
    this.entry = options.entry;
    this.absPath = options.absPath;
    this.basePath = pathLib.dirname(options.absPath);
    this.type = options.type;
    this.jsPath = options.jsPath;
    this.jsonPath = options.jsonPath;
    this.jsonConfig = options.jsonConfig;
    this.wxssPath = options.wxssPath;
    this.wxsPathList = options.wxsPathList || [];

    this.includeComponentsMap = new Map();
    this.issuer = [];
    this.enableStyleIsolation = true;

    if (this.jsonConfig) {
      const { styleIsolation } = this.jsonConfig;

      this.enableStyleIsolation =
        !styleIsolation || styleIsolation === 'isolated';
    }
  }
}

export default BaseModule;
