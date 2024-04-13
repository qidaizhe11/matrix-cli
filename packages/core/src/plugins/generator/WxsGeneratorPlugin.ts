import { logger } from '@matrix/utils';
import conditionalCompilation from '../conditional-compilation';
import type { Compiler } from '../../compiler';
import AssetWxs from '../../modules/AssetWxs';
import { Plugin } from '../../plugin';

export default class WxsGeneratorPlugin implements Plugin {
  name = 'WxsGeneratorPlugin';

  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap(this.name, (compilation) => {
      compilation.hooks.processAssets.tapPromise(
        this.name,
        async (compilation) => {
          try {
            const { wxsMap } = compilation.context;
            const { wxsPathList } = compilation.module;
            const importUrls: string[] = [];
            for (const {
              type,
              content,
              sourcePath,
              importUrl
            } of wxsMap.values()) {
              if (type === 'copy') {
                if (!wxsPathList.includes(sourcePath)) {
                  importUrls.push(importUrl);
                  continue;
                }
                if (!compilation.hasAsset(sourcePath)) {
                  const asset = new AssetWxs(
                    compilation,
                    'copy',
                    sourcePath,
                    ''
                  );
                  this.transformAssetContent(compilation, asset);
                  compilation.addAsset(sourcePath, asset);
                }
              } else if (type === 'plain') {
                if (!compilation.hasAsset(sourcePath)) {
                  const asset = new AssetWxs(
                    compilation,
                    'plain',
                    sourcePath,
                    content || ''
                  );
                  this.transformAssetContent(compilation, asset);
                  compilation.addAsset(asset.outputPath, asset);
                }
              }
            }
            if (importUrls.length > 0) {
              logger.warn(
                `[${compilation.module.name}][${this.name}] ${importUrls.join(
                  ','
                )} not found.`
              );
            }
          } catch (err) {
            logger.error(
              `[${compilation.module.name}][${this.name}] generate wxs error: ${err.message}`
            );
            throw err;
          }
        }
      );
    });
  }

  transformAssetContent(compilation, asset) {
    asset.setContent(this.transformToString(compilation, asset.content));
  }

  transformToString(compilation, content) {
    content = conditionalCompilation(content, {
      commentType: 'line',
      conditions: compilation.compiler.conditionDefinitions
    });
    content = content.replace(/module.exports\s*=/, 'export default ');
    return [
      `import { wxsRuntime } from '@matrix/runtime'`,
      `var getRegExp = wxsRuntime.getRegExp;\n`,
      content
    ].join('\n');
  }
}
