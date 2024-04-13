import { logger, maybeNpmPath } from '@matrix/utils';
import fse from 'fs-extra';
import path from 'path';
import type { Compiler } from '../../compiler';
import AssetJsx from '../../modules/AssetJsx';
import { Plugin } from '../../plugin';

export default class H5ComponentsGeneratorPlugin implements Plugin {
  name = 'H5ComponentsGeneratorPlugin';

  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap(this.name, (compilation) => {
      compilation.hooks.processAssets.tapPromise(
        this.name,
        async (compilation) => {
          try {
            const { jsonConfig, basePath } = compilation.module;
            const h5Components = jsonConfig.h5Components || {};
            const tagNotSupported: string[] = [];

            for (const key in h5Components) {
              const { tag, src } = h5Components[key];
              if (!src) {
                tagNotSupported.push(tag);
                continue;
              }
              if (maybeNpmPath(src)) {
                continue;
              }
              const h5Path = path.resolve(basePath, src);
              const content = fse.readFileSync(h5Path, 'utf-8');
              const assetH5 = new AssetJsx(compilation, h5Path, content);
              compilation.addAsset(assetH5.outputPath, assetH5);
            }
            if (tagNotSupported.length > 0) {
              logger.warn(
                `[${compilation.module.name}][${
                  this.name
                }] Tags may not supported in H5 enviroment: ${tagNotSupported.join(
                  ','
                )}, but missing src when automatically transformed to React Component.`
              );
            }
          } catch (err) {
            logger.error(
              `[${compilation.module.name}][${this.name}] ${err.message}`
            );
            throw err;
          }
        }
      );
    });
  }
}
