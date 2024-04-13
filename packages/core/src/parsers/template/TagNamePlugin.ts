import { logger, strike2camelCase } from '@matrix/utils';
import Compilation from '../../Compilation';
import type { Compiler } from '../../compiler';
import WxmlTemplateModule from '../../modules/WxmlTemplateModule';
import WxsModule from '../../modules/WxsModule';
import { Plugin } from '../../plugin';
import { ElementNode, TagTransforms } from '../../templateHooks';
import { TAG_NAME_MAP } from './constants';

export default class TagNamePlugin implements Plugin {
  name = 'TagNamePlugin';

  transforms: TagTransforms;

  constructor() {
    this.transforms = {};
    this.initTransforms();
  }

  initTransforms() {
    TAG_NAME_MAP.forEach((tagName, name) => {
      this.transforms[name] = () => tagName;
    });
  }

  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap(this.name, (compilation) => {
      compilation.templateHooks.tagRule.call(compilation, this.transforms);

      compilation.templateHooks.tagName.tap(
        this.name,
        async (compilation, elem) => {
          const name = elem.name;

          if (this.transforms[name]) {
            const transformFn = this.transforms[name];
            elem.h5Name = transformFn(compilation, elem);
          } else if (name === 'template') {
            this.parseTemplateTag(compilation, elem);
          } else if (name === 'wxs') {
            this.parseWxsTag(compilation, elem);
          } else {
            elem.h5Name = strike2camelCase(name);
          }
        }
      );
    });
  }

  parseTemplateTag(compilation: Compilation, elem: ElementNode) {
    const { name: templateName, is } = elem.attribs;

    // template 引用

    if (is) {
      const { templateMap } = compilation.context;
      const templateModule = templateMap.get(is);
      if (templateModule) {
        elem.h5Name = templateModule.componentName;
      }
      elem.attribs.callEvent = 'callEvent';
      return;
    }

    // template 声明

    // 创建wxs模块
    let templateModule;
    try {
      const children = elem.children;
      templateModule = new WxmlTemplateModule(
        compilation.module,
        templateName,
        children
      );
    } catch (err) {
      logger.error(`[${this.name}] template tag error ${err.message}`);
    }
    const { name } = templateModule;
    const { templateMap } = compilation.context;
    if (!templateMap.has(name)) {
      templateMap.set(name, templateModule);
    }
    // console.log('tempalteMap:', templateMap)
  }

  parseWxsTag(compilation: Compilation, elem: ElementNode) {
    const { module: wxsName, src: importUrl } = elem.attribs;
    let wxsModule: WxsModule;
    try {
      const children = elem.children;
      wxsModule = new WxsModule(
        compilation.module,
        wxsName,
        importUrl,
        children
      );
    } catch (err) {
      logger.error(`[${this.name}] wxs tag error ${err.message}`);
      return;
    }

    const { name } = wxsModule;
    const { wxsMap } = compilation.context;
    if (!wxsMap.has(name)) {
      wxsMap.set(name, wxsModule);
    }
    // console.log('wxsMap:', wxsMap)
  }
}
