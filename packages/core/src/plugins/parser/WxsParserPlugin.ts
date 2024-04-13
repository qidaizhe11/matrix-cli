import conditionalCompilation from '../conditional-compilation';
import fse from 'fs-extra';
import { Compiler } from '../../compiler';
import AssetWxs from '../../modules/AssetWxs';
import { Plugin } from '../../plugin';

export default class WxsParserPlugin implements Plugin {
  name = 'WxsParserPlugin';

  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap(this.name, (compilation) => {
      compilation.hooks.loadFile
        .for('wxs')
        .tapPromise(this.name, async (filePath) => {
          const source = fse.readFileSync(filePath, 'utf-8');
          return {
            content: source,
            source
          };
        });

        // TODO: 抽离 transformToString

      compilation.hooks.processFile
        .for('wxs')
        .tapPromise(this.name, async (content, filePath, file) => {
          const asset = new AssetWxs(compilation, 'copy', filePath, filePath);
          this.transformAssetContent(compilation, asset);
          compilation.addAsset(asset.outputPath, asset);
        });
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
