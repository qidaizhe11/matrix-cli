import { logger } from '@matrix/utils';
import conditionalCompilation from '../conditional-compilation';
import fse from 'fs-extra';
import pathLib from 'path';
import postcss from 'postcss';
import stripComments from 'strip-comments';
import Compilation from '../../Compilation';
import { buildLoadResult } from '../../FileResolver';
import { Compiler } from '../../compiler';
import { CSS_IMPORT_LINE_REGEXP, CSS_IMPORT_REGEXP } from '../../constants';
import WxssModule from '../../modules/WxssModule';
import { getPostcssPlugins } from '../../parsers/style/postcssPlugins';
import { Plugin } from '../../plugin';

export default class StyleParserPlugin implements Plugin {
  name = 'StyleParserPlugin';

  /**
   * css 内容整合
   */
  cssContent: string = '';

  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap(this.name, (compilation) => {
      this.cssContent = '';

      compilation.hooks.loadFile
        .for('style')
        .tapPromise(this.name, async (filePath) => {
          return this.loadFile(compilation, filePath);
        });

      compilation.hooks.collectDependencies
        .for('js')
        .tapPromise(this.name, async (dependencies, file) => {
          if (file.meta.component) {
            const wxssPath = compilation.module.wxssPath;
            try {
              const wxssFile = await compilation.fileResolver.resolveFile(
                wxssPath,
                'style'
              );

              if (wxssFile) {
                Object.assign(wxssFile.meta, file.meta);
                dependencies.add(wxssFile);
              }
            } catch (err) {
              logger.error(
                `[${compilation.module.name}][${this.name}] 收集顶层wxss出错：${err.message}`
              );
              throw err;
            }
          }
        });

      compilation.hooks.collectDependencies
        .for('style')
        .tapPromise(this.name, async (dependencies, file) => {
          if (typeof file.content !== 'string') {
            return;
          }
          const parentDir = pathLib.dirname(file.filePath);
          await Promise.all(
            [...file.content.matchAll(CSS_IMPORT_REGEXP)].map(async (it) => {
              const src = it[2];
              if (!src) {
                return;
              }

              const srcPath = await compilation.fileResolver.resolveEntry(src, {
                basedir: parentDir,
                extensions: ['.wxss']
              });
              if (!srcPath) {
                return;
              }

              const srcFile = await compilation.fileResolver.resolveFile(
                srcPath,
                'style'
              );

              if (srcFile) {
                dependencies.add(srcFile);
              }
            })
          );
        });

      compilation.hooks.collectDependenciesComplete.tapPromise(
        this.name,
        async (files) => {
          try {
            const { cssMap } = compilation.context;
            const css = this.cssContent || '';
            const content = `export default (rem) => \`${css}\``;
            const name = 'cssInsertionModule0';
            const cssModule = new WxssModule(
              compilation.module,
              name,
              compilation.module.wxssPath,
              '',
              content
            );
            if (!cssMap.has(name)) {
              cssMap.set(name, cssModule);
            }
          } catch (err) {
            logger.error(
              `[${compilation.module.name}][${this.name}] collect css error: ${err.message}`
            );
            throw err;
          }
        }
      );

      // transform
      compilation.hooks.transform
        .for('style')
        .tapPromise(this.name, async (content: string, filePath, file) => {
          return this.transform(compilation, content);
        });

      compilation.hooks.transformToString
        .for('style')
        .tapPromise(this.name, async (content: string, filePath, file) => {
          return content.replace(CSS_IMPORT_LINE_REGEXP, (m1, quote, url) => {
            return `/* @import ${quote}${url}${quote} */`;
          });
        });

      // processFile
      compilation.hooks.processFile
        .for('style')
        .tapPromise(this.name, async (content, filePath, file) => {
          this.cssContent = content + '\n\n' + this.cssContent;
          return;
        });
    });
  }

  async loadFile(compilation: Compilation, filePath: string) {
    try {
      if (!fse.existsSync(filePath)) {
        const error = new Error(
          `[${compilation.module.name}][${this.name}] wxss path not exists: ${filePath}`
        );
        throw error;
      }
      const source = await fse.readFile(filePath, { encoding: 'utf8' });
      let content = conditionalCompilation(source, {
        commentType: 'block',
        conditions: compilation.compiler.conditionDefinitions,
        keepMismatch: true
      });
      content = stripComments.block(content, {
        language: 'css'
      });
      content = content.replace(/\\e/g, '\\\\e');
      return buildLoadResult(content, source);
    } catch (err) {
      logger.error(
        `[${compilation.module.name}][${this.name}] loadFile error: ${err.message}`
      );
      throw err;
    }
  }

  async transform(compilation: Compilation, content: string) {
    const { name, enableStyleIsolation } = compilation.module;

    const postcssPlugins = getPostcssPlugins(enableStyleIsolation ? name : '');

    const result = await postcss(postcssPlugins).process(content, {
      from: undefined,
      map: undefined
    });
    return result.css;
  }
}
