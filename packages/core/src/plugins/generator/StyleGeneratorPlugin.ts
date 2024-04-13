import { logger } from '@matrix/utils';
import type { Compiler } from '../../compiler';
import AssetWxss from '../../modules/AssetWxss';
import { Plugin } from '../../plugin';

export default class StyleGeneratorPlugin implements Plugin {
  name = 'StyleGeneratorPlugin';

  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap(this.name, (compilation) => {
      compilation.hooks.processAssets.tapPromise(
        this.name,
        async (compilation) => {
          try {
            const { cssMap } = compilation.context;
            for (const { absPath, content } of cssMap.values()) {
              const assetWxss = new AssetWxss(compilation, absPath, content);
              compilation.addAsset(assetWxss.outputPath, assetWxss);
            }
          } catch (err) {
            logger.error(
              `[${compilation.module.name}][${this.name}] generate css code error: ${err.message}`
            );
            throw err;
          }
        }
      );
    });
  }
}
