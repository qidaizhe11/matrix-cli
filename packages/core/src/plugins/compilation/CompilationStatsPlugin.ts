import type { Compiler } from '../../compiler';
import { Plugin } from '../../plugin';

export default class CompilationStatsPlugin implements Plugin {
  name = 'CompilationStatsPlugin';

  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap(this.name, (compilation) => {
      compilation.hooks.complete.tap(this.name, (compilation) => {
        if (!compiler.stats.complete) {
          compiler.stats.complete = [];
        }
        compiler.stats.complete.push({
          rawname: compilation.module && compilation.module.name,
          basePath: compilation.module && compilation.module.basePath
        });
      });

      compilation.hooks.fail.tap(this.name, (compilation, error) => {
        if (!compiler.stats.fail) {
          compiler.stats.fail = [];
        }
        compiler.stats.fail.push({
          rawname: compilation.module && compilation.module.name,
          basePath: compilation.module && compilation.module.basePath,
          error
        });
      });
    });
  }
}
