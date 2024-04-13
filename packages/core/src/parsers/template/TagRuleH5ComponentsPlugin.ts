import { logger, strike2camelCase } from '@matrix/utils';
import Compilation from '../../Compilation';
import type { Compiler } from '../../compiler';
import { Plugin } from '../../plugin';
import { ElementNode } from '../../templateHooks';

export default class TagRuleH5ComponentsPlugin implements Plugin {
  name = 'TagRuleH5ComponentsPlugin';

  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap(this.name, (compilation) => {
      compilation.templateHooks.tagRule.tap(
        this.name,
        async (compilation, transforms) => {
          const h5Components = compilation.module.jsonConfig.h5Components || {};
          logger.info(
            `[${compilation.module.name}][${
              this.name
            }] h5Components: ${Object.keys(h5Components).join(',')}`
          );

          Object.keys(h5Components).forEach((tag) => {
            transforms[tag] = this.tagTransform.bind(this);
          });
        }
      );
    });
  }

  tagTransform(compilation: Compilation, elem: ElementNode) {
    const { tagName, props, src } = this.getH5CompInfo(compilation, elem.name);

    elem.attribs = {
      ...elem.attribs,
      ...props
    };

    elem.name = tagName;
    return tagName;
  }

  getH5CompInfo(compilation: Compilation, name: string) {
    const h5Components = compilation.module.jsonConfig.h5Components || {};
    const compInfo = h5Components[name];
    if (!compInfo)
      return {
        tagName: this.formatTagName(name),
        props: {}
      };
    if (typeof compInfo === 'string')
      return {
        tagName: this.formatTagName(name),
        props: {}
      };
    const tagName = this.formatTagName(compInfo.tag);
    const props = compInfo.props;
    return {
      tagName,
      props,
      src: compInfo.src
    };
  }

  formatTagName(tag) {
    return strike2camelCase(tag);
  }
}
