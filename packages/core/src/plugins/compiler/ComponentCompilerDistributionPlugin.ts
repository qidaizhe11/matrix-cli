import { logger } from '@matrix/utils';
import type { Compiler } from '../../compiler';
import { Plugin } from '../../plugin';

export default class ComponentCompilerDistributionPlugin implements Plugin {
  name = 'ComponentCompilerDistributionPlugin';

  apply(compiler: Compiler) {
    compiler.hooks.compile.tap('compilation', (compiler) => {
      const { flattedModulesMap } = compiler.context;
      if (flattedModulesMap.size === 0) {
        logger.warn(`[${this.name}] flattedModulesMap is empty`);
        compiler.hooks.fail.call(
          compiler,
          new Error(`[${this.name}] flattedModulesMap is empty`)
        );
        return;
      }
      for (const module of flattedModulesMap.values()) {
        logger.info(`[${module.name}][${this.name}] Compilation created.`);

        compiler.hooks.make.tapAsync('make', (callback) => {
          const params = {};
          const compilation = compiler.createCompilation(module, params);
          compilation.compile(callback);
        });
      }
    });
  }
}
