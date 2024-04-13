import {
  AsyncParallelHook,
  AsyncSeriesBailHook,
  AsyncSeriesHook,
  AsyncSeriesWaterfallHook,
  HookMap,
  SyncHook
} from 'tapable';
import type Compilation from './Compilation';
import { File, FileDependency, LoadFileResultOrigin } from './FileResolver';

export interface CompilationHooks {
  /**
   * 1. initialize hook: 初始化加载各种 parser 和 visitor
   */
  initialize: AsyncSeriesHook<[Compilation]>;

  /**
   * 2. wxml 编译流程
   */
  parseTemplate: AsyncSeriesHook<[Compilation]>;

  /**
   * wxml 编译流程后
   */
  afterParseTemplate: AsyncParallelHook<[Compilation]>;

  /**
   * 3. 依赖收集开始
   */
  collectionStart: AsyncParallelHook<[Compilation]>;

  /**
   * 4. 依赖收集完成
   */
  collectionComplete: AsyncParallelHook<[Compilation, Error | null]>;

  /**
   * assets 资源生成前
   */
  beforeProcessAssets: AsyncParallelHook<[Compilation]>;

  /**
   * 5. assets 资源生成
   */
  processAssets: AsyncParallelHook<[Compilation]>;

  /**
   * 6. compilation 完成
   */
  complete: SyncHook<Compilation>;

  /**
   * 6. compilation 失败
   */
  fail: SyncHook<[Compilation, Error]>;

  /**
   * 文件加载
   */
  loadFile: HookMap<
    AsyncSeriesBailHook<[filePath: string], LoadFileResultOrigin>
  >;

  /**
   * 文件转换 transform
   */
  transform: HookMap<
    AsyncSeriesWaterfallHook<
      [contents: unknown, destPath: string, file: File | null]
    >
  >;

  /**
   * 文件文本转换输出
   */
  transformToString: HookMap<
    AsyncSeriesWaterfallHook<
      [contents: unknown, destPath: string, file: File | null]
    >
  >;

  /**
   * 文件生成
   */
  processFile: HookMap<
    AsyncSeriesWaterfallHook<[contents: unknown, destPath: string, file: File]>
  >;

  /**
   * 依赖收集
   */
  collectDependencies: HookMap<
    AsyncParallelHook<[result: Set<FileDependency>, file: File]>
  >;

  /**
   * 依赖收集完成
   */
  collectDependenciesComplete: AsyncSeriesHook<[files: File[]]>;
}

export function createHooks() {
  const hooks: CompilationHooks = {
    initialize: new AsyncSeriesHook(['compilation']),

    parseTemplate: new AsyncSeriesHook(['compilation']),

    afterParseTemplate: new AsyncParallelHook(['compilation']),

    collectionStart: new AsyncParallelHook(['compilation']),

    collectionComplete: new AsyncParallelHook(['compilation', 'error']),

    beforeProcessAssets: new AsyncParallelHook(['compilation']),

    processAssets: new AsyncParallelHook(['compilation']),

    complete: new SyncHook(['compilation']),

    fail: new SyncHook(['compilation', 'error']),

    loadFile: new HookMap(() => new AsyncSeriesBailHook(['filePath'])),

    transform: new HookMap(
      () => new AsyncSeriesWaterfallHook(['contents', 'destPath', 'file'])
    ),

    transformToString: new HookMap(
      () => new AsyncSeriesWaterfallHook(['contents', 'destPath', 'file'])
    ),

    processFile: new HookMap(
      () => new AsyncSeriesWaterfallHook(['contents', 'destPath', 'file'])
    ),

    collectDependencies: new HookMap(
      () => new AsyncParallelHook(['result', 'file'])
    ),

    collectDependenciesComplete: new AsyncSeriesHook(['files'])
  };

  return hooks;
}
