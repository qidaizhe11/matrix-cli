import { logger } from '@matrix/utils';
import DependencyCollector from './DependencyCollector';
import FileResolver from './FileResolver';
import { CompilationHooks, createHooks } from './compilationHooks';
import type { Compiler } from './compiler';
import AssetBase from './modules/AssetBase';
import BaseModule from './modules/BaseModule';
import WxmlTemplateModule from './modules/WxmlTemplateModule';
import WxsModule from './modules/WxsModule';
import WxssModule from './modules/WxssModule';
import { TemplateHooks, createTemplateHooks } from './templateHooks';

export interface CompilationContext {
  /**
   * jsx 格式的模板内容
   */
  templateJsxContent?: string;

  /**
   * `this.data.`前缀节点收集
   */
  addThisDataCollector: Set<string>;

  /**
   * 入口 wxml `this.data.`前缀节点收集
   */
  entryAddThisDataCollector: Set<string>;

  /**
   * template 收集，key: template.name
   */
  templateMap: Map<string, WxmlTemplateModule>;

  /**
   * wxs 收集，key: wxs.module
   */
  wxsMap: Map<string, WxsModule>;

  /**
   * css 内容整合
   */
  cssMap: Map<string, WxssModule>;
}

export type CompilationAssets = Record<string, Set<AssetBase>>;

class Compilation {
  compiler: Compiler;

  module: BaseModule;

  hooks: CompilationHooks;

  context: CompilationContext;

  /**
   * 收集待产生文件的assets
   */
  assets: CompilationAssets;

  fileResolver: FileResolver;

  templateHooks: TemplateHooks;

  dependencyCollector: DependencyCollector;

  constructor(compiler: Compiler, module: BaseModule) {
    this.compiler = compiler;
    this.module = module;

    this.hooks = createHooks();

    this.assets = {};

    this.context = {
      addThisDataCollector: new Set(),
      entryAddThisDataCollector: new Set(),
      templateMap: new Map(),
      wxsMap: new Map(),
      cssMap: new Map()
    };

    this.fileResolver = new FileResolver(this);

    this.dependencyCollector = new DependencyCollector(this);

    this.templateHooks = createTemplateHooks();
  }

  async compile(callback: () => void) {
    this.hooks.initialize.callAsync(this, (error) => {
      if (error) {
        logger.warn(
          `[${this.module.name}][Compilation initialize] Failed when initialize compilation.`
        );
        this.hooks.fail.call(this, error);
        callback();
        return;
      }

      logger.success(
        `[${this.module.name}][Compilation initialize] Compilation has been initialized.`
      );

      // 编译模板
      this.hooks.parseTemplate.callAsync(this, (error) => {
        if (error) {
          logger.error(
            `[${this.module.name}][Compilation parseTemplate] ${error.message}`
          );
          this.hooks.fail.call(this, error);
          callback();
          return;
        }

        this.hooks.afterParseTemplate.promise(this).then(() => {
          // 依赖收集
          this.hooks.collectionStart
            .promise(this)
            .then(() => this.hooks.collectionComplete.promise(this, null))
            .then(() => {
              this.hooks.beforeProcessAssets.promise(this).then(() => {
                // 生成资源信息
                this.hooks.processAssets.callAsync(this, (error) => {
                  if (error) {
                    logger.error(
                      `[${this.module.name}][Compilation processAssets] ${error.message}`
                    );
                    this.hooks.fail.call(this, error);
                    callback();
                    return;
                  }

                  this.hooks.complete.call(this);
                  callback();
                });
              });
            });
        });
      });
    });
  }

  // 判断compiler的assets中是否已存在资源
  hasAsset(path: string) {
    return this.compiler.assets.has(path);
  }

  /**
   * 向compiler的assets中加入资源
   * @param path 资源绝对路径
   * @param asset 资源对象
   * @param noImport 是否需要在jsx文件中import的资源 true：不需要
   */
  addAsset(path: string, asset: AssetBase, noImport?: boolean) {
    if (!this.hasAsset(path)) {
      this.compiler.assets.set(path, asset);
    }

    const matchArray = path.match(/\.(.*?)$/);
    if (!matchArray) {
      return;
    }

    // compilation也保存assets方便jsx中引入文件
    const ext = matchArray[1];
    let assetModule = this.assets[ext];
    if (!assetModule) {
      assetModule = new Set();
      // 不需要在jsx文件中import的资源
      !noImport && (this.assets[ext] = assetModule);
    }
    assetModule.add(asset);
  }
}

export default Compilation;
