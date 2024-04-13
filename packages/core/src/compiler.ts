import { logger, Log } from '@matrix/utils';
import Compilation from './Compilation';
import { File } from './FileResolver';
import { CompilerHooks, createHooks } from './compilerHooks';
import AssetBase from './modules/AssetBase';
import type BaseModule from './modules/BaseModule';
import { Plugin } from './plugin';
import designPlugins from './plugins/design';
import designLibraryPlugins from './plugins/designLibrary';
import { ConditionDefinition } from './types';

export interface CompilerOptions {
  /**
   * 用户项目根目录
   */
  root: string;

  /**
   * 待编译的组件 or 页面 相对项目根目录
   */
  entry: string;

  /**
   * 主入口 wxml 文件名称
   */
  entryWxml: string;

  /**
   * 转化后输出目录
   */
  outdir: string;

  /**
   * watch 监听模式
   */
  watch?: boolean;

  /**
   * 装修组件专用模式
   */
  design?: boolean;

  /**
   * 装修组件 utils 等工具库组件专用模式
   */
  designLibrary?: boolean;

  /**
   * 系统页装修标识
   */
  pageDesign?: boolean;

  /**
   * 定制 entry name
   */
  entryComponentName?: string;

  /**
   * 编译完成回调
   * @param successComponents 成功组件列表
   * @param failedComponents 失败组件列表
   * @param timeCost 编译总用时
   */
  done?: (
    successComponents: string[],
    failedComponents: string[],
    timeCost: string,
    logs: Log[]
  ) => void;
}

interface CompileResultInfo {
  /**
   * 模块 rawname
   */
  rawname: string;

  /**
   * 模块 basePath
   */
  basePath: string;
}

export interface CompileCompleteInfo extends CompileResultInfo {}

export interface CompileFaileInfo extends CompileResultInfo {
  error: Error;
}

export interface CompilerStats {
  /**
   * 编译开始时间
   */
  startTime?: number;

  /**
   * 编译结束时间
   */
  endTime?: number;

  /**
   * 编译总用时
   */
  timeCost?: string;

  /**
   * 编译成功信息
   */
  complete?: CompileCompleteInfo[];

  /**
   * 编译失败信息
   */
  fail?: CompileFaileInfo[];
}

export type CompileAssets = Map<string, AssetBase>;

export interface CompileContext {
  /**
   * moduleMap，存储入口下所有模块
   * Map<key, module>，key: wxml 文件 absPath
   */
  flattedModulesMap: Map<string, BaseModule>;

  /**
   * collectionsMap，存储 library 所有收集
   */
  collectionsMap: Map<string, File>;
}

export class Compiler {
  /**
   * Compiler 入参
   */
  options: CompilerOptions;

  /**
   * 插件列表
   */
  plugins: Plugin[];

  /**
   * 条件编译目标平台
   */
  conditionDefinitions: ConditionDefinition[];

  /**
   * 收集小程序公共数据，方便多个子流水线(compilation)共享数据
   */
  context: CompileContext;

  /**
   * 最终要输出的 assets
   */
  assets: CompileAssets;

  /**
   * 统计信息（编译成功or失败的信息，编译用时等）
   */
  stats: CompilerStats;

  /**
   * hooks 钩子
   */
  hooks: CompilerHooks;

  /**
   * 装修组件
   */
  isDesignPlatform: boolean;

  /**
   * 装修组件 utils 等工具库组件
   */
  isDesignLibrary: boolean;

  /**
   * 系统页装修标识
   */
  isPageDesign: boolean;

  constructor(options: CompilerOptions) {
    this.options = options;
    this.conditionDefinitions = ['H5'];

    this.isDesignPlatform = !!options.design;
    this.isDesignLibrary = !!options.designLibrary;
    this.isPageDesign = !!options.pageDesign;

    this.init();
  }

  /**
   * 等待初始化完成，开启编译
   */
  run() {
    this.hooks.initialize.callAsync(this, this.stats, (err) => {
      if (err) {
        return;
      }
      this.build();
    });
  }

  /**
   * 触发重新编译
   */

  rebuild() {
    this.init();
    this.run();
  }

  createCompilation(module: BaseModule, params: any) {
    const compilation = new Compilation(this, module);
    this.hooks.compilation.call(compilation, params);
    return compilation;
  }

  private init() {
    this.context = {
      flattedModulesMap: new Map(),
      collectionsMap: new Map()
    };

    this.assets = new Map();

    this.stats = {};

    this.hooks = createHooks();

    this.registerPlugins();
  }

  private build() {
    this.hooks.entryDependency.call(this);
    this.hooks.beforeCompile.call(this);
    this.hooks.compile.call(this);
    this.hooks.make.callAsync((err) => {
      this.hooks.beforeEmitAssets.call(this);
      this.hooks.emitAssets.callAsync(this.assets, this.options, (err) => {
        this.hooks.done.call(this, this.stats, this.assets);
        this.hooks.afterDone.call(this, this.stats, this.assets);
      });
    });
  }

  private registerPlugins() {
    let plugins: Plugin[] = [];

    if (this.isDesignPlatform) {
      if (this.isDesignLibrary) {
        plugins = [...designLibraryPlugins];
      } else {
        plugins = [...designPlugins];
      }
    }

    plugins.forEach((plugin) => {
      if (typeof plugin.apply !== 'function') {
        logger.error(
          `[Compiler registPlugins] plugin missing method \`apply\`: ${plugin}`
        );
        return;
      }
      plugin.apply(this);
    });
  }
}

export default function (options: CompilerOptions) {
  return new Compiler(options);
}
