import { lowerCaseNormalizePath } from '@matrix/utils';
import Compilation from './Compilation';
import { File, FileDependency } from './FileResolver';

interface CollectorState {
  result: Map<string, File>;
}

export default class DependencyCollector {
  name = 'DependencyCollector';

  compilation: Compilation;

  /**
   * 依赖收集中
   */
  isCollecting: boolean;

  /**
   * 依赖收集报错
   */
  hasCollectingError: boolean;

  currentCollectState: CollectorState | null;

  constructor(compilation: Compilation) {
    this.compilation = compilation;

    // 依赖收集开始
    compilation.hooks.collectionStart.tapPromise(this.name, async () => {
      this.isCollecting = true;
      this.hasCollectingError = false;
      this.currentCollectState = null;
      await this.onCollectionStart(compilation);
    });

    // 依赖收集结束
    compilation.hooks.collectionComplete.tapPromise(
      this.name,
      async (compilation, err) => {
        this.isCollecting = false;

        if (err) {
          this.hasCollectingError = true;
          return;
        }

        return await this.onCollectionComplete(compilation);
      }
    );
  }

  async onCollectionStart(compilation: Compilation) {
    if (!compilation.module.jsPath) {
      return;
    }

    // 先收集基础依赖
    const baseFiles: Set<File> = new Set();

    const rootJsFile = await compilation.fileResolver.resolveFile(
      compilation.module.jsPath,
      'js'
    );

    Object.assign(rootJsFile.meta, {
      component: true
    });

    await this.collectModuleFileDependencies(
      compilation,
      baseFiles,
      rootJsFile
    );

    // 搜集剩余依赖
    await this.collectDependencies(compilation, baseFiles);
  }

  async onCollectionComplete(compilation: Compilation) {
    const entries = this.currentCollectState?.result;

    const entrySet = new Set(entries?.values() || []);

    // console.log('entrySet:', entrySet)

    const files = [...entrySet];

    await this.processFiles(compilation, files);

    await compilation.hooks.collectDependenciesComplete.promise(files);
  }

  ensureCollectState() {
    let state = this.currentCollectState;
    if (!state) {
      state = {
        result: new Map()
      };
      this.currentCollectState = state;
    }
    return state;
  }

  async collectDependencies(compilation: Compilation, baseFiles: Set<File>) {
    await Promise.all(
      [...baseFiles].map(async (file) => {
        await this.collectFileDependencies(compilation, file);
      })
    );
  }

  async collectFileDependencies(compilation: Compilation, pendingFile: File) {
    const state = this.ensureCollectState();

    const dependencies: Set<File> = new Set();

    const lowerCaseName = lowerCaseNormalizePath(pendingFile.filePath);
    // 已经被遍历过，无需再遍历
    if (state.result.has(lowerCaseName)) {
      return;
    }
    state.result.set(lowerCaseName, pendingFile);

    await this.collectModuleFileDependencies(
      compilation,
      dependencies,
      pendingFile
    );

    await Promise.all(
      [...dependencies].map(
        async (dependency) =>
          await this.collectFileDependencies(compilation, dependency)
      )
    );
  }

  async collectModuleFileDependencies(
    compilation: Compilation,
    result: Set<FileDependency>,
    file: File
  ) {
    const deps: Set<FileDependency> = new Set();

    await compilation.hooks.collectDependencies
      .get(file.fileType)
      ?.promise(deps, file);

    deps.forEach((dep) => {
      result.add(dep);
    });
  }

  async processFiles(compilation: Compilation, files: File[]) {
    const errors: Error[] = [];

    await Promise.all(
      files.map(async (file) => {
        try {
          await this.processFile(compilation, file);
        } catch (e) {
          errors.push(e);
        }
      })
    );

    if (errors.length !== 0) {
      console.error('解析文件失败！', errors);
      throw new Error('解析文件失败！' + errors);
    }
  }

  async processFile(compilation: Compilation, file: File) {
    let contents = file.content;
    contents = await compilation.hooks.transform
      .get(file.fileType)
      ?.promise(file.content, file.filePath, file);

    contents = await compilation.hooks.transformToString
      .get(file.fileType)
      ?.promise(contents, file.filePath, file);

    await compilation.hooks.processFile
      .get(file.fileType)
      ?.promise(contents, file.filePath, file);
  }
}
