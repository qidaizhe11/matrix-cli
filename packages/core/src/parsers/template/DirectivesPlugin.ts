import { logger } from '@matrix/utils';
import type { Compiler } from '../../compiler';
import { Plugin } from '../../plugin';
import { DirectiveOptions, directive } from './directive';

export default class DirectivesPlugin implements Plugin {
  name = 'DirectivesPlugin';

  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap(this.name, (compilation) => {
      compilation.templateHooks.directives.tap(
        this.name,
        (tagContent, compilation, elem) => {
          const { directives, variables } = elem.collector || {};
          if (!directives) {
            return tagContent;
          }
          const dirs = Object.keys(directives);
          if (dirs.length === 0) {
            return tagContent;
          }

          /**
           * 解析 for循环中关键字 wx:for-item、wx:for-index、wx:key
           */
          let options: DirectiveOptions;
          if (dirs.includes('for') && variables) {
            options = {
              item: variables.item || 'item',
              index: variables.index || 'index',
              key: variables.key || 'index',
            };

            options.key = variables.key || options.index || 'index';
          }

          /**
           * 同一个标签上同时有for和if时，for优先级高于if
           *  Step1：增加一个新的指令：forWithIf，值取for和if的值
           *  Step2：删除指令for和if
           *  Step3：在Directive解析时增加forWithIf，循环和条件表达式的组合，见`../modules/Directive`
           */
          if (dirs.includes('for') && dirs.includes('if')) {
            dirs.unshift('forWithIf');
            directives['forWithIf'] = [
              directives['for'] as string,
              directives['if'] as string
            ];
            const forIdx = dirs.indexOf('for');
            dirs.splice(forIdx, 1);
            const ifIdx = dirs.indexOf('if');
            dirs.splice(ifIdx, 1);
          }

          tagContent = dirs.reduce((tagContent, dir) => {
            return directive(elem, dir, directives[dir], tagContent, options);
          }, tagContent);

          return tagContent;
        }
      );
    });
  }
}
