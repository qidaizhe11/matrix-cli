import { getLogs, logger } from '@matrix/utils';
import type { Compiler } from '../../compiler';
import { Plugin } from '../../plugin';

export default class CompilerStatsPlugin implements Plugin {
  name = 'CompilerStatsPlugin';

  apply(compiler: Compiler) {
    compiler.hooks.done.tap(this.name, (compiler, stats, assets) => {
      stats.endTime = Date.now();
      const startTime = stats.startTime || 0;
      const endTime = stats.endTime || 0;
      const cost = endTime - startTime;
      if (cost >= 1000) {
        const s = cost / 1000 + 's';
        stats.timeCost = s;
      } else {
        const ms = cost + 'ms';
        stats.timeCost = ms;
      }
    });

    compiler.hooks.done.tap(this.name, (compiler, stats, assets) => {
      // 显示组件编译结果的统计信息
      if (!stats.complete) {
        stats.complete = [];
      }
      if (!stats.fail) {
        stats.fail = [];
      }
      if (stats.complete.length) {
        logger.success(
          `[${this.name}] success components [${stats.complete
            .map((stat) => stat.rawname)
            .join(', ')}]`
        );
      }
      if (stats.fail.length) {
        logger.error(
          `[${this.name}] failed components [${stats.fail
            .map((stat) => stat.rawname)
            .join(', ')}]`
        );
      }
      logger.success(`[Global Statistics] The project: ${compiler.options.root}
        Total ${stats.complete.length + stats.fail.length} component(s)
        With ${stats.complete.length} success, ${stats.fail.length} error(s)
        Generated ${assets.size} asset(s)
        Target h5
        Outdir ${compiler.options.outdir}`);

      logger.success(`[${this.name}] Time cost: ${stats.timeCost || 0}`);
    });

    compiler.hooks.done.tap(this.name, (compiler, stats, assets) => {
      if (!compiler.options.done) {
        return;
      }
      if (!stats.complete) {
        stats.complete = [];
      }
      if (!stats.fail) {
        stats.fail = [];
      }
      if (typeof compiler.options.done === 'function') {
        try {
          // logger.success(
          //   `[${this.name}] invoke compiler.options.done succeed.`
          // );
          compiler.options.done(
            stats.complete.map((stat) => stat.rawname),
            stats.fail.map((stat) => stat.rawname),
            stats.timeCost || '',
            getLogs()
          );
        } catch (e) {
          logger.error(
            `[${this.name}] Failed when invoke compiler.options.done ${e.message}`
          );
        }
      } else {
        logger.error(
          `[${this.name}] compiler.options.done expected to be type of function`
        );
      }
    });
  }
}
