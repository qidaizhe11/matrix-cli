import Compilation from '../../Compilation';
import type { Compiler } from '../../compiler';
import { Plugin } from '../../plugin';
import {
  AttributeOrigin,
  AttributesOrigin,
  ElementNode
} from '../../templateHooks';
import { attributePriorityRanking } from './utils';

export default class AttributesPlugin implements Plugin {
  name = 'AttributesPlugin';

  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap(this.name, (compilation) => {
      compilation.templateHooks.attributes.tap(
        this.name,
        (compilation, elem) => {
          const attributes = elem.attribs;
          if (!attributes) {
            return;
          }

          const attrContent = this.formatAttributes(
            compilation,
            attributes,
            elem
          );
          elem.attrContent = attrContent;
        }
      );
    });
  }

  // 所有属性，key-value数组
  formatAttributes(
    compilation: Compilation,
    attributes: AttributesOrigin,
    elem: ElementNode
  ) {
    const keys = Object.keys(attributes);
    keys.forEach((key, i, keys) => {
      if (key === 'hidden') {
        this.resolveHidden(keys, attributes);
      }
    });
    if (attributes['wx:for'] && !attributes['wx:key']) {
      attributes['wx:key'] = '';
    }
    const keysAfterRanking = attributePriorityRanking(Object.keys(attributes));
    return keysAfterRanking
      .map((key) => {
        const attributeOrigin: AttributeOrigin = {
          key,
          value: attributes[key]
        };
        return this.formatAttribute(compilation, attributeOrigin, elem);
      })
      .join(' ');
  }

  // 每一项属性
  formatAttribute(
    compilation: Compilation,
    attributeOrigin: AttributeOrigin,
    elem: ElementNode
  ) {
    const attrInfo = compilation.templateHooks.attribute.call(
      compilation,
      attributeOrigin,
      elem
    );
    if (!attrInfo) {
      return '';
    }
    const { attrName, attrValue, removeAttribute, removeQuotes } = attrInfo;
    if (removeAttribute) return '';
    if (removeQuotes) return attrName + '=' + attrValue;
    return attrName + '="' + attrValue + '"';
  }

  /**
   * 特殊处理 hidden 属性
   * 1. 如果标签中存在style属性，则合并 display:{表达式} 到 style字符串值中
   * 2. 如果标签中不存在style属性，则新增style属性，将 display: {表达式} 添加到 style字符串值中
   */
  resolveHidden(keys: string[], attributes: AttributesOrigin) {
    if (keys.includes('style')) {
      // 如果行内样式存在display则优先级最高，直接忽略hidden
      // 如果行内样式不存在display，则将hidden表达式转化为display三元表达式
      if (!/display/.test(attributes.style)) {
        attributes.style = this.mergeStyle(
          attributes.style,
          this.getDisplay(attributes)
        );
      }
    } else {
      attributes.style = `display: {{ ${this.getDisplay(attributes)} }}`;
    }
    // 处理完hidden后删除该属性
    delete attributes.hidden;
  }

  getDisplay(attributes: AttributesOrigin) {
    const hidden = attributes.hidden;
    if (/\{\{(.*?)\}\}/.test(hidden)) {
      const display = attributes.hidden.replace(
        /\{\{(.*?)\}\}/,
        (_, hiddenExp) => {
          return `${hiddenExp} ? "none" : ""`; // hidden为false时，display为空字符串，会继承父级属性
        }
      );
      return display;
    } else {
      return `${hidden} ? "none" : ""`;
    }
  }

  mergeStyle(toStyle: string, fromStyleValue: string) {
    const styleList = toStyle.split(';');
    styleList.push(`display: {{${fromStyleValue}}}`);
    return styleList.join(';');
  }
}
