import type { Compiler } from '../../compiler';
import { Plugin } from '../../plugin';

export default class TemplateParserPlugin implements Plugin {
  name = 'TemplateParserPlugin';

  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap(this.name, (compilation) => {
      compilation.hooks.parseTemplate.tapPromise(
        this.name,
        async (compilation) => {}
      );
    });
  }
}
