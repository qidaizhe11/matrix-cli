import generator from '@babel/generator';
import { parseExpression } from '@babel/parser';
import { Expression } from '@babel/types';
import { camelcase, fakeGuid, logger, rpx2rem } from '@matrix/utils';
import Compilation from '../../Compilation';
import type { Compiler } from '../../compiler';
import { Plugin } from '../../plugin';
import { ElementNode, TemplateNode } from '../../templateHooks';
import collectThisData, { ThisDataCollect } from './collectThisData';
import {
  ATTRS_MAP,
  DIRECTIVES_MAP,
  EVENTS_MAP,
  REMOVE_ATTRIBUTES,
  VARIABLES_MAP
} from './constants';

interface FormatMustacheValueOptions {
  /**
   * template 标签内 data 属性
   */
  isTemplateData?: boolean;

  /**
   * callback 回调
   * @param code 转换后输出内容
   * @param before
   * @param after
   * @returns 转换后输出内容
   */
  callback?: (code: string, before: string, after: string) => string;

  /**
   * 最外层不自动添加 ``
   */
  disableGlobalBacktick?: boolean;

  /**
   * 最外层不自动添加 {}
   */
  disableGlobalGrace?: boolean;

  /**
   * 解析过程中添加参数，有待优化置于 result 中
   */
  hasBeforeOrAfter?: boolean;
}

interface StyleResolved {
  isPaired: boolean;
  key?: string;
  value: string;
  removeQuotes?: boolean;
}

export default class AttributeAndTextPlugin implements Plugin {
  name = 'AttributeAndTextPlugin';

  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap(this.name, (compilation) => {
      compilation.templateHooks.textNode.tap(this.name, (compilation, elem) => {
        const data = elem.data || '';
        let text = data;
        if (/\{\{(.*?)\}\}/.test(data)) {
          text = this.formatSingleMustacheValue(data, elem, compilation, {
            callback: (code, before, after) => {
              return `${before || ''}{${code}}${after || ''}`;
            }
          });
        }
        elem.content = text;
      });

      /**
       * 1、系统内置的属性名转换规则
       *    指令，比如wx:if wx:for等需要修改 dom 结构的
       *    事件，比如bindtap -> onClick
       *    变量，比如wx:key -> key
       *    普通待转换属性，比如class -> className
       *    其他
       * 2、扩展其他属性名类型转换规则
       */

      /**
       * 指令
       *  形如：A="{{B}}"
       *  举例：wx:if="{{xxx}}""
       *       wx:for="{{xxx}}" wx:for="array"(可以接受字符串)
       */
      compilation.templateHooks.attribute.tap(
        this.name,
        (compilation, attr, elem) => {
          if (!DIRECTIVES_MAP.has(attr.key)) {
            return;
          }

          const attrName = DIRECTIVES_MAP.get(attr.key);
          if (!attrName) {
            return;
          }
          let attrValue = attr.value;
          if (/\{\{(.*)\}\}/.test(attr.value)) {
            attrValue = this.formatSingleMustacheValue(
              attr.value,
              elem,
              compilation,
              {
                callback: (code) => code
              }
            );
          } else {
            // 如果是字符串，则转化为数组
            attrValue = attr.value ? `[${attr.value.split(',')}]` : '';
          }
          if (elem.collector) {
            elem.collector.directives[attrName] = attrValue;
            if (['if', 'elif', 'else'].includes(attrName)) {
              const elemKey = fakeGuid();
              elem.matrixKey = elemKey;
              elem.parent &&
                elem.parent.collector &&
                elem.parent.collector.conditions_children.push({
                  attrName: attrName,
                  attrValue: attrValue,
                  matrixKey: elemKey
                });
            }
            // 如果是for，则自动默认 item index
            if (attrName === 'for') {
              elem.collector.variables.item = 'item';
              elem.collector.variables.index = 'index';
              // collector.variables.key = 'index' 不能加这句，放在 DirectivesPlugin 中加 key 了
            }
          }

          return {
            attrName,
            attrValue,
            removeAttribute: true
          };
        }
      );

      /**
       * 事件
       * 形如：bindtap="save" => onClick={this.save}
       * 或者：bind:save="save" => onSave={this.save}
       */
      compilation.templateHooks.attribute.tap(
        this.name,
        (compilation, attr, elem) => {
          const { key, value } = attr;
          if (EVENTS_MAP.has(key) || /^(bind:|catch:|bind|catch)/.test(key)) {
            let attrName = key;
            const eventMapValue = EVENTS_MAP.get(key);
            if (eventMapValue) {
              attrName = eventMapValue;
            } else {
              attrName = attrName.replace(/^(bind:|catch:|bind|catch)/, 'on');
              attrName = camelcase(attrName);
              attrName =
                attrName.substring(0, 2) +
                attrName[2].toUpperCase() +
                attrName.substring(3);
            }
            let attrValue = value;
            if (/\{\{(.*)\}\}/.test(value)) {
              const formatedValue = this.formatSingleMustacheValue(
                value,
                elem,
                compilation,
                { callback: (code) => code }
              );
              attrValue = formatedValue;
            } else {
              attrValue = `"${attrValue}"`;
            }
            attrValue = `{ wmrt.event(${attrValue}, this) }`;
            return {
              attrName,
              attrValue,
              removeQuotes: true
            };
          }
        }
      );

      /**
       * 变量
       * 形如：wx:key="item.id" / "*this"
       *      wx:for-index="index1"
       *      wx:for-item="item1"
       */
      compilation.templateHooks.attribute.tap(
        this.name,
        (compilation, attr, elem) => {
          if (!VARIABLES_MAP.has(attr.key)) {
            return;
          }

          const { key, value } = attr;
          const attrName = VARIABLES_MAP.get(key);
          if (!attrName) {
            return;
          }
          let attrValue = `{ ${value}}`;
          if (attr.key !== 'wx:key' && /\{\{(.*)\}\}/.test(value)) {
            attrValue = value.replace(/\{\{(.*?)\}\}/g, function (_, $1) {
              return `{ ${$1} }`;
            });
          }

          if (key === 'wx:key') {
            if (value.includes('{{')) {
              logger.error(
                `[${this.name}] 标签 ${elem.name} 的属性 wx:key ${key} = ${value} 中使用了不支持的数据绑定语法: {{}}\n允许的值为 字符串 或 *this \n`
              );
            }
          }

          if (elem.collector) {
            if (key === 'wx:key') {
              let keyValue = value;
              const item = elem.collector.variables.item || 'item';
              const index = elem.collector.variables.index || 'index';
              /**
             * 特殊处理 *this（*this代表for循环中的item本身）
             *  Rule1. 要求item本身是一个唯一的字符串或数字
             *  Rule2. 要求item不能是对象
             */
              if (value && value.trim() === '*this') {
                keyValue = item;
              } else if (value && value !== index) {
                keyValue = `${item}.${value}`
              }
              if (!keyValue) {
                keyValue = index;
              }
              elem.collector.variables.key = keyValue;
              attrValue = `{ ${keyValue} }`;
            } else {
              elem.collector.variables[attrName] = value;
            }
          }

          const result = {
            attrName,
            attrValue,
            removeAttribute: REMOVE_ATTRIBUTES.includes(key),
            removeQuotes: true
          };
          return result;
        }
      );

      /**
       * 特殊的属性
       * 形如：class="xxx" -> className="xxx"
       * 形如：style="font-size: {{styleSetting.wm_size/2}}px;" -> style={{'font-size':{styleSetting.wm_size/2}, a:b}}
       * 形如：id="xxx" 或 id="{{exp}}"
       */
      compilation.templateHooks.attribute.tap(
        'AttributeAttr',
        (compilation, attr, elem) => {
          const { key, value } = attr;
          if (!ATTRS_MAP.has(key)) {
            return;
          }
          switch (key) {
            case 'style':
            case 'ext-style':
            case 'extStyle':
              return {
                attrName: ATTRS_MAP.get(key) || key,
                attrValue: this.formatStyleValue(value, elem, compilation),
                removeQuotes: true
              };
            case 'class':
            case 'id':
            case 'ext-class': {
              const useCssScope =
                (key === 'class' || key === 'ext-class') &&
                compilation.module.enableStyleIsolation;
              return {
                attrName: ATTRS_MAP.get(key) || key,
                ...this.formatRuntimeAttrValue(value, elem, compilation, {
                  useCssScope
                })
              };
            }
            case 'ref': {
              if (/^\{\{(.*?)\}\}$/.test(value)) {
                return {
                  attrName: key,
                  attrValue: this.formatMultipleMustacheValue(
                    value,
                    elem,
                    compilation
                  ),
                  removeQuotes: true,
                };
              }
              return {
                attrName: key,
                ...this.formatRuntimeAttrValue(value, elem, compilation),
              };
            }
          }
        }
      );

      /**
       * 处理dataset：data-xxxx
       * 形如：data-item="{{item}}" -> data-item={wmrt.stringify(item)}
       */
      compilation.templateHooks.attribute.tap(
        'AttributeDataset',
        (compilation, attr, elem) => {
          const { key, value } = attr;
          if (!key.startsWith('data-')) return;

          let attrValue = value;
          let removeQuotes = false;
          if (/\{\{(.*?)\}\}/.test(value)) {
            attrValue = this.formatSingleMustacheValue(
              value,
              elem,
              compilation,
              {
                callback: (code) => `{wmrt.stringify(${code})}`
              }
            );
            removeQuotes = true;
          } else {
            attrValue = value;
            removeQuotes = false;
          }
          const result = {
            attrName: key,
            attrValue,
            removeQuotes
          };
          return result;
        }
      );

      /**
       * template tag 下 data 及 callEvent 属性的特殊处理
       */
      compilation.templateHooks.attribute.tap(
        this.name,
        (compilation, attr, elem) => {
          const { key, value } = attr;
          if (
            !(
              elem.name === 'template' &&
              (key === 'data' || key === 'callEvent')
            )
          ) {
            return;
          }
          if (key === 'callEvent') {
            return {
              attrName: key,
              attrValue: '{this.callEvent}',
              removeQuotes: true
            };
          }
          let attrValue = value;
          let removeQuotes = false;
          if (/\{\{(.*)\}\}/.test(value)) {
            removeQuotes = true;
            attrValue = this.formatSingleMustacheValue(
              value,
              elem,
              compilation,
              {
                isTemplateData: true
              }
            );
          }
          return {
            attrName: key,
            attrValue,
            removeQuotes
          };
        }
      );

      /**
       * 最后留一个保底的规则
       * {{msg}} => {this.data.msg}
       * height:{{hbgd}}rpx => height:{this.data.hbgd}rpx
       */
      compilation.templateHooks.attribute.tap(
        this.name,
        (compilation, attr, elem) => {
          let { key, value } = attr;
          if (!value) {
            // value 为空的变量，视同 value = true bool 型
            value = '{{true}}';
          }
          let attrValue = value;
          let removeQuotes = false;
          if (/\{\{(.*)\}\}/.test(value)) {
            attrValue = this.formatMultipleMustacheValue(
              value,
              elem,
              compilation
            );
            removeQuotes = true;
          }
          return {
            attrName: camelcase(key),
            attrValue,
            removeQuotes
          };
        }
      );
    });
  }

  /**
  * 样式处理：
    "font-size: {{styleSetting.wm_size/2}}px;"
    -> {{'fontSize':{styleSetting.wm_size/2}, a:b}}

    "font-size: '20px'; display:{{a?'none':'block'}}"
    -> {{'fontSize':'20px', display: a?'none':'block'}}
  */
  formatStyleValue(value: string, elem: ElementNode, compilation: Compilation) {
    const styleRegExp = /\{\{(.*?)\}\}/g;
    const placeholderRegExp = /([^{}]+)?(\{PLACEHOLDER[\d]+\})([^{}]+)?/g;
    const placeholderMaps = {};
    let strValue = value;
    if (styleRegExp.test(value)) {
      let regExpIndex = 0;
      // {{}} 表达式临时替换为 {PLACEHOLDERxx} 形式以便切割，原表达式暂存于 placeholderMaps
      strValue = value.replace(styleRegExp, (_, $1) => {
        const placeholder = `{PLACEHOLDER${regExpIndex}}`;
        regExpIndex++;
        placeholderMaps[placeholder] = $1;
        return placeholder;
      });
    }

    const splited = strValue.split(';');

    const getCommonFormattedValue = (value: string) => {
      const result = this.formatMultipleMustacheValue(
        value,
        elem,
        compilation,
        {
          disableGlobalGrace: true,
          callback: (code, before, after) => {
            let result = '';
            if (before || after) {
              result = `${before || ''}$\{${code}\}${after || ''}`;
            } else {
              result = code;
            }
            return `...wmrt.style( ${result} ),`;
          }
        }
      );
      if (result.endsWith(',')) {
        return result.substring(0, result.length - 1);
      }
      return result;
    };

    const resolved: (StyleResolved | null)[] = splited.map((styleItem) => {
      if (placeholderRegExp.test(styleItem)) {
        // styleItem 内含 {PLACEHOLDERxx}，还原
        styleItem = styleItem.replace(
          placeholderRegExp,
          (_, before, exp, after) => {
            return `${before || ''}{{${placeholderMaps[exp]}}}${after || ''}`;
          }
        );
      }

      if (/^\{\{(.*?)\}\}$/.test(styleItem)) {
        const exp = getCommonFormattedValue(styleItem);
        return {
          isPaired: false,
          value: exp
        };
      }

      if (styleItem.includes(':')) {
        // 该项包括 : 分隔
        let [k, v] = this.splitBy(styleItem);
        k = k.trim();
        v = v.trim();

        // key 中含有 {{ 表达式，等同该项不包括 : 分隔处理
        if (/\{\{(.*?)/.test(k)) {
          const exp = getCommonFormattedValue(styleItem);
          return {
            isPaired: false,
            value: exp
          };
        }

        // style中 中划线转驼峰，-- 开头自定义变量不转换
        if (k && !k.startsWith('--') && /-/.test(k)) {
          k = camelcase(k);
        }
        // style中 {{exp}} 去掉{{}} 标识符转换
        if (/\{\{(.*?)\}\}/.test(v)) {
          const options: FormatMustacheValueOptions = {
            disableGlobalGrace: true,
            callback: (code, before, after) => {
              return `${before || ''}$\{${code}\}${after || ''}`;
            },
          };
          v = this.formatMultipleMustacheValue(v, elem, compilation, options);
          v = `wmrt.rem(\`${v}\`)`;

          return {
            isPaired: true,
            key: k,
            value: v,
            removeQuotes: true
          };
        } else {
          // 不含 {{}} 表达式
          let removeQuotes = false;
          if (/(rpx|px)/.test(v)) {
            v = rpx2rem(v, true);
            if (v.includes('${')) {
              v = '`' + v + '`';
            }
            removeQuotes = true;
          }
          return {
            isPaired: true,
            key: k,
            value: v,
            removeQuotes
          };
        }
      } else {
        // 该项不包括 : 分隔
        return null;
      }
    });

    const resultList = resolved
      .filter((item): item is StyleResolved => !!item)
      .map((item) => {
        if (item.isPaired) {
          return `"${item.key}": ${
            item.removeQuotes ? item.value : `"${item.value}"`
          }`;
        }
        return item.value;
      });

    return '{{' + resultList.join(',') + '}}';
  }

  formatRuntimeAttrValue(
    value: string,
    elem: ElementNode,
    compilation: Compilation,
    options: {
      useCssScope?: boolean;
    } = {}
  ) {
    let attrValue = value;
    let removeQuotes = false;
    const componentName = compilation.module.name;
    const classNameRuntime = (code) => {
      return `wmrt.cn(${code}, "${componentName}")`;
    };

    const classNameRegExp = /\{\{(.*?)\}\}/g;
    const placeholderRegExp = /([^{}]+)?(\{PLACEHOLDER[\d]+\})([^{}]+)?/g;

    if (classNameRegExp.test(value)) {
      // className 内含有 {{}} 表达式，特殊处理

      const placeholderMaps = {};
      let regExpIndex = 0;
      // {{}} 表达式临时替换为 {PLACEHOLDERxx} 形式以便切割，原表达式暂存于 placeholderMaps
      const strValue = value.replace(classNameRegExp, (_, $1) => {
        const placeholder = `{PLACEHOLDER${regExpIndex}}`;
        regExpIndex++;
        placeholderMaps[placeholder] = $1;
        return placeholder;
      });

      // 根据空白字符切割 className，切割后每一项添加 __componentName 后缀
      let items = strValue.split(/\s+/).filter((item) => item);

      items = items.map((itemValue) => {
        if (placeholderRegExp.test(itemValue)) {
          // itemValue 内含 {PLACEHOLDERxx}，还原并转换 js 表达式
          itemValue = itemValue.replace(
            placeholderRegExp,
            (_, before, exp, after) => {
              // 原表达式
              const realExp = placeholderMaps[exp];
              // 转换 js 表达式
              exp = this.formatSingleMustacheValue(
                `{{ ${realExp} }}`,
                elem,
                compilation,
                {
                  callback: options.useCssScope
                    ? classNameRuntime
                    : (code) => code,
                  disableGlobalBacktick: true
                }
              );
              let result = '';
              if (before || after) {
                result = `${before || ''}$\{${exp}\}${after || ''}`;
              } else {
                result = `$\{${exp}\}`;
              }
              return result;
            }
          );
          return itemValue;
        } else {
          if (options.useCssScope) {
            return `${itemValue}__${componentName}`;
          }
          return itemValue;
        }
      });

      attrValue = `\{\`${items.join(' ')}\`\}`;
      removeQuotes = true;
    } else {
      // 根据空白字符切割 className，切割后每一项添加 __componentName 后缀
      const valueSplit = value
        .split(' ')
        .map((item) => {
          if (options.useCssScope) {
            return item && item + '__' + componentName;
          }
          return item;
        })
        .filter((item) => item);
      attrValue = valueSplit.join(' ');
      removeQuotes = false;
    }

    return {
      attrValue,
      removeQuotes
    };
  }

  formatMultipleMustacheValue(
    value: string,
    elem: TemplateNode,
    compilation: Compilation,
    options: FormatMustacheValueOptions = {}
  ): string {
    const matches = value.match(/([^{}]+)?\{\{(.*?)\}\}([^{}]+)?/g);
    if (!matches) {
      return value;
    }
    let hasBeforeOrAfter = false;
    const singleOptions: FormatMustacheValueOptions = {
      callback: (code, before, after) => {
        let result = '';
        if (before || after) {
          hasBeforeOrAfter = true;
          result = `${before || ''}$\{${code}\}${after || ''}`;
        } else {
          result = code;
        }
        return result;
      },
      disableGlobalBacktick: true,
      ...options
    };

    const items = matches.map((matchStr) => {
      const itemStr = this.formatSingleMustacheValue(
        matchStr,
        elem,
        compilation,
        singleOptions
      );
      return itemStr;
    });

    options.hasBeforeOrAfter = hasBeforeOrAfter;
    if (options.disableGlobalGrace) {
      return items.join('');
    }
    if (!hasBeforeOrAfter) {
      return `{ ${items.join('')} }`;
    }
    return `\{\`${items.join('')}\`\}`;
  }

  /**
   * 转换{{xx}}语法
   * 1. 标识符
   *    {{name}}
   * 2. 二元运算表达式
   *    {{index === current}}
   *    {{index === 'current'}}
   *    {{index === wxsFooModule}}
   * 3. 条件表达式
   *    {{index === current ? 'current' : ''}}
   *    {{index===current?'current':a}}
   *    {{index===current?'current':a.b.c}}
   * 4. 对象表达式
   *    {{name, module, value}}
   *    {{[a, b, c]}}
   *    {{...name}}
   */
  formatSingleMustacheValue(
    value: string,
    elem: TemplateNode,
    compilation: Compilation,
    options: FormatMustacheValueOptions = {}
  ) {
    let newValue = value;
    if (/\{\{(.*)\}\}/.test(value)) {
      newValue = value.replace(
        /([^{}]+)?\{\{(.*?)\}\}([^{}]+)?/g,
        (_, before, expStr, after) => {
          // template tag 内 data 元素单独处理
          if (options.isTemplateData) {
            // 对象表达式
            if (expStr.includes('...') && expStr.includes(',')) {
              expStr = `{${expStr}}`;
            } else {
              if (expStr.includes('...')) {
                expStr = `${expStr.slice(3)}`;
              } else {
                expStr = `{${expStr}}`;
              }
            }
          }
          let exp: Expression;
          try {
            exp = parseExpression(expStr, { sourceType: 'module' });
          } catch (e) {
            logger.error(`[${compilation.module.name}][${this.name}][babel.parse Expression] ${e.reasonCode}: \`${expStr}\`
        Possible reasons are:
          This expression includes keywords or reserved keywords in javascript, such as function var const let switch for in break...
          This expression includes unmatched quotes with double or single.
          This is not a correct expression for javascript.`);
            throw e;
          }
          const addThisDataCollector: ThisDataCollect[] = [];
          collectThisData(exp, addThisDataCollector);
          try {
            addThisDataCollector.forEach(({ node, thisData }) => {
              const name = node.name;
              // 标识符属于for循环的变量或属于wxs模块名则保持原样
              if (
                this.isUnderScopeFor(elem, name) ||
                name === 'undefined'
                // (compilation.context.wxsModuleNames &&
                //   compilation.context.wxsModuleNames.includes(name))
              ) {
                return;
              }
              compilation.context.addThisDataCollector.add(thisData);
            });
          } catch (e) {
            logger.error(
              `[${compilation.module.name}][${this.name}][add this.data to exp] ${e.message}`
            );
          }

          // ast转code
          let code = generator(exp).code;
          if (typeof options.callback === 'function') {
            code = options.callback(code, before, after);
            return code;
          }
          if (options.disableGlobalGrace) {
            return code;
          }
          return `{ ${code} }`;
        }
      );
    }

    if (options.disableGlobalBacktick) {
      return newValue;
    }
    return newValue.includes('${') ? '`' + newValue + '`' : newValue;
  }

  // 用：分割字符串
  splitBy(str: string, flag: string = ':'): [string, string] {
    const idx = str.indexOf(flag);
    return [str.slice(0, idx), str.slice(idx + 1)];
  }

  // 判断是 *this
  isStarThis(value: string) {
    return !!(value && value.trim() === '*this');
  }

  isForAttribute(variables: Record<string, string>, attr: string) {
    attr = attr.split('.')[0];
    return (
      variables.item === attr ||
      variables.index === attr ||
      variables.key === attr
    );
  }

  isUnderScopeFor(elem: TemplateNode, attr) {
    let current: TemplateNode | null = elem;
    while (current) {
      const { directives, variables } = current.collector || {};
      const dirs = directives ? Object.keys(directives) : [];
      if (
        dirs.includes('for') &&
        variables &&
        this.isForAttribute(variables, attr)
      ) {
        return true;
      }
      current = current.parent;
    }
    return false;
  }
}
