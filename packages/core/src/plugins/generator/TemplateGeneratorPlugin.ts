import generate from '@babel/generator';
import { parseExpression } from '@babel/parser';
import template from '@babel/template';
import traverse, { NodePath, Visitor } from '@babel/traverse';
import {
  File,
  Program,
  identifier,
  importDeclaration,
  importDefaultSpecifier,
  isCallExpression,
  isIdentifier,
  isJSXAttribute,
  isJSXIdentifier,
  isJSXOpeningElement,
  jsxExpressionContainer,
  memberExpression,
  returnStatement,
  stringLiteral,
  thisExpression
} from '@babel/types';
import { logger } from '@matrix/utils';
import Compilation from '../../Compilation';
import type { Compiler } from '../../compiler';
import AssetJsx from '../../modules/AssetJsx';
import WxmlTemplateModule from '../../modules/WxmlTemplateModule';
import { Plugin } from '../../plugin';
import { commonImportDeclarationAdd } from './JsxGeneratorPlugin';
import createWxmlTemplateAst from './wxmlTemplateAst';

export default class TemplateGeneratorPlugin implements Plugin {
  name = 'TemplateGeneratorPlugin';

  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap(this.name, (compilation) => {
      compilation.hooks.processAssets.tapPromise(
        this.name,
        async (compilation) => {
          try {
            const { templateMap } = compilation.context;
            for (const templateModule of templateMap.values()) {
              compilation.context.addThisDataCollector.clear();

              let jsxContent: string = await this.generateTemplateJsxContent(
                compilation,
                templateModule
              );
              jsxContent = `<React.Fragment>
      ${jsxContent}
    </React.Fragment>`;

              const jsxCode = this.generateJsxCode(
                compilation,
                templateModule,
                jsxContent
              );

              const asset = new AssetJsx(
                compilation,
                templateModule.absPath,
                jsxCode
              );
              compilation.addAsset(asset.outputPath, asset);
            }
          } catch (err) {
            logger.error(
              `[${compilation.module.name}][${this.name}] generate template code error: ${err.message}`
            );
            throw err;
          }
        }
      );
    });
  }

  async generateTemplateJsxContent(
    compilation: Compilation,
    templateModule: WxmlTemplateModule
  ) {
    const astNodes = await compilation.hooks.transform
      .for('template')
      ?.promise(templateModule.children, templateModule.absPath, null);

    const content = (await compilation.hooks.transformToString
      .for('template')
      ?.promise(astNodes, templateModule.absPath, null)) as string;
    return content;
  }

  generateJsxCode(
    compilation: Compilation,
    templateModule: WxmlTemplateModule,
    jsxContent: string
  ) {
    const jsxAst = createWxmlTemplateAst();

    this.jsxTransform(compilation, jsxAst, templateModule, jsxContent);

    const jsxCode: string = generate(jsxAst, {
      comments: true
    }).code;

    return jsxCode;
  }

  jsxTransform(
    compilation: Compilation,
    ast: File,
    templateModule: WxmlTemplateModule,
    jsxContent: string
  ) {
    const { addThisDataCollector } = compilation.context;
    const enterVisitor: Visitor = {
      ClassDeclaration: function (path) {
        path.node.id.name = templateModule.componentName;
      },
      ClassMethod: function (path) {
        if (isIdentifier(path.node.key) && path.node.key.name === 'render') {
          try {
            const templateAst = parseExpression(jsxContent, {
              plugins: ['jsx']
            });
            path.node.body.body[0] = returnStatement(templateAst);

            const idStr = [...addThisDataCollector].join(', ');
            const thisDataNode = template(`
            const { wmrt } = this.props;
            const { ${idStr} } = this.props.data;
            `)();
            path.node.body.body.unshift(...thisDataNode);
          } catch (err) {
            console.error(err);
            logger.error(`[${compilation.module.name}][TemplateGeneratorPlugin babel.parse template] ${err.reasonCode}: \`${jsxContent}\`
        Possible reasons are:
          This expression includes keywords or reserved keywords in javascript, such as function var const let switch for in break...
          This expression includes unmatched quotes with double or single.
          This is not a correct expression for javascript.`);
            throw err;
          }
        }
      },
      ExportDefaultDeclaration: function (path) {
        const declaration = path.node.declaration;
        if (
          isCallExpression(declaration) &&
          isIdentifier(declaration.callee) &&
          declaration.callee.name === 'wxmlTemplate'
        ) {
          declaration.arguments.forEach((argument) => {
            if (
              isIdentifier(argument) &&
              argument.name === 'TemplateComponent'
            ) {
              argument.name = templateModule.componentName;
            }
          });
        }
      },
      JSXIdentifier: function (path) {
        const { name } = path.node;
        if (name.endsWith('Template')) {
          // callEvent 修正：this.callEvent -> this.props.callEvent
          const parentNode = path.parentPath.node;
          if (isJSXOpeningElement(parentNode)) {
            parentNode.attributes.forEach((attribute) => {
              if (
                isJSXAttribute(attribute) &&
                isJSXIdentifier(attribute.name) &&
                attribute.name.name === 'callEvent'
              ) {
                attribute.value = jsxExpressionContainer(
                  memberExpression(
                    memberExpression(thisExpression(), identifier('props')),
                    identifier('callEvent')
                  )
                );
              }
            });
          }
        }
      }
    };

    const exitFunc = (path: NodePath<Program>) => {
      const { templateMap } = compilation.context;

      commonImportDeclarationAdd(compilation, path);

      for (const { componentName, importUrl } of templateMap.values()) {
        if (componentName === templateModule.componentName) {
          continue;
        }
        const importNode = importDeclaration(
          [importDefaultSpecifier(identifier(componentName))],
          stringLiteral(importUrl)
        );
        path.node.body.unshift(importNode);
      }
    };

    traverse(ast, {
      Program: {
        enter(path) {
          path.traverse(enterVisitor);
        },
        exit(path) {
          exitFunc(path);
        }
      }
    });

    return ast;
  }
}
