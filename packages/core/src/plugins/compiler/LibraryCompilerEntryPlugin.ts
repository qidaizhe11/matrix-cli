import { logger } from '@matrix/utils';
import { glob } from 'glob';
import path from 'path';

import { File } from '../../FileResolver';
import type { Compiler } from '../../compiler';
import BaseModule from '../../modules/BaseModule';
import { Plugin } from '../../plugin';

export default class LibraryCompilerEntryPlugin implements Plugin {
  name = 'LibraryCompilerEntryPlugin';

  compiler: Compiler;

  collectionsMap: Map<string, File>;

  apply(compiler: Compiler) {
    compiler.hooks.entryDependency.tap(this.name, (compiler) => {
      this.compiler = compiler;
      this.init();
      this.collectAll();
      compiler.context.collectionsMap = this.collectionsMap;
    });

    compiler.hooks.compile.tap('compilation', (compiler) => {
      compiler.hooks.make.tapAsync('make', (callback) => {
        const { options } = compiler;
        const { entry, root } = options;
        const baseModule = new BaseModule({
          entry: path.resolve(root, entry),
          name: '',
          type: 'Component',
          absPath: '',
          jsonConfig: {
            component: true,
            usingComponents: {}
          },
          jsonPath: '',
          jsPath: '',
          wxssPath: '',
          wxsPathList: [],
        });
        const compilation = compiler.createCompilation(baseModule, {});
        compilation.compile(callback);
      });
    });
  }

  init() {
    this.collectionsMap = new Map();
  }

  // 收集所有文件
  collectAll() {
    const { options } = this.compiler;
    const { entry, root } = options;

    const matches: (File | undefined)[] = glob
      .sync(`${entry}/**/*`, { cwd: root })
      .map((item) => {
        const extname = path.extname(item);
        const absPath = path.resolve(root, item);
        if (['.ts', '.js'].includes(extname) && !item.endsWith('.d.ts')) {
          return {
            fileType: 'js',
            filePath: absPath,
            meta: {}
          };
        }

        if (extname === '.wxss') {
          return {
            fileType: 'wxss',
            filePath: absPath,
            meta: {}
          };
        }

        if (extname === '.wxs') {
          return {
            fileType: 'wxs',
            filePath: absPath,
            meta: {}
          };
        }
      })
      .filter((item) => !!item);
    if (!matches || matches.length === 0) {
      logger.warn(
        `[${this.name} glob] entry: '${entry}' got empty, make sure 'entry' field is correct.`
      );
      return;
    }
    logger.success(
      `[${this.name} glob] entry '${entry}' got: ${matches
        .map((item: any) => item.filePath)
        .join('\n')}`
    );
    matches.forEach((item) => {
      if (item) {
        this.collectionsMap.set(item.filePath, item);
      }
    });
  }
}
