import type { Compiler } from '../../compiler';
import AssetBase from '../../modules/AssetBase';
import { Plugin } from '../../plugin';

export default class CompilerEmitAssetsPlugin implements Plugin {
  name = 'CompilerEmitAssetsPlugin';

  apply(compiler: Compiler) {
    compiler.hooks.emitAssets.tapAsync(
      this.name,
      (assets, options, callback) => {
        const allAssetsWrite: Promise<unknown>[] = [];
        for (const asset of assets.values()) {
          if (this.isAssetFail(compiler, asset)) {
            continue;
          }
          const p = new Promise((resolve, reject) => {
            asset.write(resolve, reject);
          });
          allAssetsWrite.push(p);
        }
        Promise.all(allAssetsWrite).then(() => {
          callback();
        }, callback);
      }
    );
  }

  isAssetFail(compiler: Compiler, asset: AssetBase) {
    const failStats = compiler.stats.fail;
    if (!failStats || (failStats && failStats.length === 0)) {
      return false;
    }
    if (failStats.some((stat) => asset.absPath.startsWith(stat.basePath))) {
      return true;
    }
    return false;
  }
}
