import { isString, logger } from '@matrix/utils';
import conditionalCompilation from '../conditional-compilation';
import { DomHandler } from 'domhandler';
import fse from 'fs-extra';
import { ElementType, Parser } from 'htmlparser2';
import Compilation from '../../Compilation';
import { buildLoadResult } from '../../FileResolver';
import type { Compiler } from '../../compiler';
import { Plugin } from '../../plugin';
import {
  CommentNode,
  ElementNode,
  TemplateNode,
  TextNode,
  initNodeCollector
} from '../../templateHooks';

function templateTransform(fileContent: string): TemplateNode[] {
  let ast: TemplateNode[] = [];
  const htmlParser = new Parser(
    new DomHandler((error, dom) => {
      if (error) {
        logger.error(`[Compilation htmlparser2] ${error.message}`);
        return;
      }
      ast = dom;
    }),
    {
      lowerCaseAttributeNames: false,
      lowerCaseTags: false,
      recognizeSelfClosing: true
    }
  );
  htmlParser.write(fileContent);
  htmlParser.end();
  return ast;
}

export default class TemplateParserPlugin implements Plugin {
  name = 'TemplateParserPlugin';

  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap(this.name, (compilation) => {
      compilation.hooks.parseTemplate.tapPromise(
        this.name,
        async (compilation) => {
          const wxmlAbsPath = compilation.module.absPath;

          try {
            const file = await compilation.fileResolver.resolveFile(
              wxmlAbsPath,
              'template'
            );

            const astNodes = await compilation.hooks.transform
              .for('template')
              ?.promise(file.content, file.filePath, file);

            const content = await compilation.hooks.transformToString
              .for('template')
              ?.promise(astNodes, file.filePath, file);

            if (content && isString(content)) {
              compilation.context.templateJsxContent = content;
              compilation.context.entryAddThisDataCollector = new Set(
                JSON.parse(
                  JSON.stringify(
                    Array.from(compilation.context.addThisDataCollector)
                  )
                )
              );

              // console.log('templateJsxConent:', content);
            } else {
              throw new Error('wxml解析失败!');
            }
          } catch (error) {
            logger.error(
              `[${compilation.module.name}][${this.name} templateParser] ${error.message}`
            );
            throw error;
          }
        }
      );

      compilation.hooks.loadFile
        .for('template')
        .tapPromise(this.name, async (filePath) => {
          let wxmlContent = fse.readFileSync(filePath, { encoding: 'utf8' });
          wxmlContent = conditionalCompilation(wxmlContent, {
            commentType: 'xml',
            conditions: compiler.conditionDefinitions
          });
          return buildLoadResult(wxmlContent, wxmlContent);
        });

      compilation.hooks.transform
        .for('template')
        .tapPromise(
          this.name,
          async (contents: TemplateNode[] | string, filePath) => {
            let astNodes: TemplateNode[];
            if (isString(contents)) {
              astNodes = templateTransform(contents);
            } else {
              astNodes = contents;
            }
            logger.success(
              `[${compilation.module.name}][${this.name} templateParser] build template to ast succeed.`
            );
            this.transformTemplateNodes(astNodes, compilation);
            return astNodes;
          }
        );

      compilation.hooks.transformToString
        .for('template')
        .tapPromise(this.name, async (astNodes: TemplateNode[], filePath) => {
          return this.generateTemplateNodes(astNodes, compilation);
        });
    });
  }

  transformTemplateNodes(nodes: TemplateNode[], compilation: Compilation) {
    for (let i = 0; i < nodes.length; ++i) {
      const node = nodes[i];
      this.transformTemplateNode(node, compilation);
    }
  }

  transformTemplateNode(node: TemplateNode, compilation: Compilation) {
    // 修正 node
    this.correctTemplateNode(node);

    switch (node.type) {
      case ElementType.Comment:
        return this.transformComment(node);
      case ElementType.Script:
      case ElementType.Style:
      case ElementType.Tag:
        return this.transformTag(node, compilation);
      case ElementType.Text:
        return this.transformText(node, compilation);
    }
  }

  correctTemplateNode(node: TemplateNode) {
    // fix2: 小程序的image/img标签 会把其后的同级兄弟元素作为它的children节点
    // <image src></image>
    if (
      node.type === ElementType.Tag &&
      ['image', 'img'].includes(node.name) &&
      node.children &&
      node.children.length > 0
    ) {
      node.children = [];
    }

    // fix3: root 节点补充 collector 收集要素
    if (
      node.parent &&
      (node.parent.type === ElementType.Root ||
        (node.parent.type === ElementType.Tag &&
          node.parent.name === 'template')) &&
      !node.parent.collector
    ) {
      node.parent.collector = {
        directives: {},
        variables: {},
        conditions_children: [] // 收集直接子节点的条件指令
      };
    }
  }

  /**
   * 元素节点
   */
  transformTag(elem: ElementNode, compilation: Compilation) {
    // collector 初始化
    elem.collector = initNodeCollector();

    // 标签
    compilation.templateHooks.tagName.call(compilation, elem);
    if (!elem.h5Name) {
      return;
    }

    // 属性
    compilation.templateHooks.attributes.call(compilation, elem);

    // 子节点
    if (elem.children.length > 0) {
      this.transformTemplateNodes(elem.children, compilation);
    }
  }

  /**
   * 文本节点
   */
  transformText(elem: TextNode, compilation: Compilation) {
    compilation.templateHooks.textNode.call(compilation, elem);
  }

  /**
   * 注释节点
   */
  transformComment(elem: CommentNode) {
    elem.content = '{/* ' + elem.data + ' */}';
  }

  generateTemplateNodes(
    nodes: TemplateNode[],
    compilation: Compilation
  ): string {
    let content = '';
    for (let i = 0; i < nodes.length; ++i) {
      const node = nodes[i];
      content += this.generateTemplateNode(node, compilation);
    }
    return content;
  }

  generateTemplateNode(node: TemplateNode, compilation: Compilation) {
    switch (node.type) {
      case ElementType.Script:
      case ElementType.Style:
      case ElementType.Tag:
        return this.generateTag(node, compilation);
      default:
        return node.content;
    }
  }

  /**
   * 元素节点生成，内部针对子节点递归调用
   * @param elem 节点 Node
   * @returns 节点转换后 content 内容（包含子节点转换内容）
   */
  generateTag(elem: ElementNode, compilation: Compilation): string {
    let content = '';

    // 标签
    if (!elem.h5Name) return '';
    content = '<' + elem.h5Name;

    // 属性
    const attrContent = elem.attrContent;
    if (attrContent) {
      content += ' ' + attrContent;
    }

    // 3. 孩子、单标签、自闭合标签
    if (elem.isSingleTag) {
      content += '/>';
    } else {
      content += '>';
      if (elem.children.length > 0) {
        content += this.generateTemplateNodes(elem.children, compilation);
      }
      if (!elem.isSingleTag) {
        content += '</' + elem.h5Name + '>';
      }
    }

    // 指令
    content = compilation.templateHooks.directives.call(
      content,
      compilation,
      elem
    );

    return content;
  }
}
