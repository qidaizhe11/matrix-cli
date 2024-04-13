import { logger } from '@matrix/utils';
import type { Compiler } from '../../compiler';
import { Plugin } from '../../plugin';

export default class CompilerInitializePlugin implements Plugin {
  name = 'CompilerInitializePlugin';

  apply(compiler: Compiler) {
    compiler.hooks.initialize.tapAsync(
      this.name,
      (compiler, stats, callback) => {
        logger.info('hh');
      }
    );
  }
}
