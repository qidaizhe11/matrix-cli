import { AsyncParallelHook, AsyncSeriesHook, SyncHook } from 'tapable';
import Compilation from './Compilation';
import type { Compiler } from './compiler';
import { CompileAssets, CompilerOptions, CompilerStats } from './compiler';

export interface CompilerHooks {
  //
  // 1. initialize阶段
  //

  /**
   * 1.1 initialize hook 添加额外的初始化逻辑
   */
  initialize: AsyncSeriesHook<[Compiler, CompilerStats]>;

  //
  // 2. compile阶段
  //

  /**
   * 2.1 entryDependency hook: 处理入口模块
   */
  entryDependency: SyncHook<Compiler>;

  /**
   * 2.2 beforeCompile hook: 编译前增加其他逻辑，比如增加entry等
   */
  beforeCompile: SyncHook<Compiler>;

  /**
   * 2.3 compile hook: 开始编译，遍历所有入口模块
   */
  compile: SyncHook<Compiler>;

  /**
   * 2.4 make hook： 异步并行型钩子，连接compiler和compilation的钩子，针对每个模块进行编译，管控小的编译过程
   */
  make: AsyncParallelHook<any>;

  /**
   * 2.5 compilation hook: 给compilation注入hooks逻辑
   */
  compilation: SyncHook<[compilation: Compilation, params: any]>;

  //
  // 3. emit阶段
  //

  // /**
  //  * 3.1 shouldEmit hook：是否应该继续生成文件，同步熔断型钩子
  //  */
  // shouldEmit: SyncBailHook<Compiler, any>;

  /**
   * 3.2 beforeEmitAssets hook：在生成文件前，可以继续添加一些新的文件逻辑（比如对文件进一步编译等），这是最后一次改变assets的机会，可以继续新增一些 assets
   */
  beforeEmitAssets: SyncHook<Compiler>;

  /**
   * 3.3 emitAssets hook：生成文件
   */
  emitAssets: AsyncParallelHook<[CompileAssets, CompilerOptions]>;

  //
  // 4. done阶段
  //

  /**
   * 4.1 done hook: 编译完成，可以做一些数据统计展示之类的需求，比如统计编译耗时等
   */
  done: SyncHook<[Compiler, CompilerStats, CompileAssets]>;

  /**
   * 4.2 afterDone hook: 可以做一些收尾、清理环境等工作，比如清理垃圾文件/文件夹等
   */
  afterDone: SyncHook<[Compiler, CompilerStats, CompileAssets]>;

  /**
   * 任何一阶段报错
   */
  fail: SyncHook<[Compiler, Error]>;

  /**
   * 统计信息 增加统计逻辑，比如统计编译耗时，统计编译成功or失败的组件信息
   */
  // stats: SyncHook<[Compiler, CompilerStats, CompileAssets]>;
}

export function createHooks() {
  const hooks: CompilerHooks = {
    initialize: new AsyncSeriesHook(['compiler', 'stats']),

    entryDependency: new SyncHook(['compiler']),

    beforeCompile: new SyncHook(['compiler']),

    compile: new SyncHook(['compiler']),

    make: new AsyncParallelHook([]),

    compilation: new SyncHook(['compilation', 'params']),

    // shouldEmit: new SyncBailHook(['compiler']),

    beforeEmitAssets: new SyncHook(['compiler']),

    emitAssets: new AsyncParallelHook(['assets', 'options']),

    done: new SyncHook(['compiler', 'stats', 'assets']),

    afterDone: new SyncHook(['compiler', 'stats', 'assets']),

    fail: new SyncHook(['compiler', 'error'])

    // stats: new SyncHook(['compiler', 'stats', 'assets'])
  };

  return hooks;
}
