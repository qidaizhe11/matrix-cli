import generate from '@babel/generator';
import { parseExpression } from '@babel/parser';
import template from '@babel/template';
import traverse, { NodePath, Visitor } from '@babel/traverse';
import {
  Expression,
  File,
  Program,
  Statement,
  expressionStatement,
  identifier,
  importDeclaration,
  importDefaultSpecifier,
  importSpecifier,
  isCallExpression,
  isExpression,
  isExpressionStatement,
  isIdentifier,
  isImportDeclaration,
  isJSXAttribute,
  isJSXIdentifier,
  isObjectExpression,
  isStringLiteral,
  jsxAttribute,
  jsxClosingElement,
  jsxElement,
  jsxExpressionContainer,
  jsxIdentifier,
  jsxOpeningElement,
  memberExpression,
  objectProperty,
  returnStatement,
  stringLiteral,
  thisExpression
} from '@babel/types';
import { logger, strike2camelCase } from '@matrix/utils';
import { cloneDeep } from 'lodash';
import Compilation from '../../Compilation';
import type { Compiler } from '../../compiler';
import AssetJsx from '../../modules/AssetJsx';
import { Plugin } from '../../plugin';
import createComponentTemplateAst from './componentTemplateAst';

function isMiniConstructor(node: Statement) {
  return (
    isExpressionStatement(node) &&
    isCallExpression(node.expression) &&
    isIdentifier(node.expression.callee) &&
    ['Component', 'Page', 'App'].includes(
      node.expression.callee.name
    )
  );
}

/**
 * 通用顶层 import 添加逻辑
 * @param compilation
 * @param path
 */
export function commonImportDeclarationAdd(
  compilation: Compilation,
  path: NodePath<Program>
) {
  const { wxsMap } = compilation.context;
  const { jsonConfig, includeComponentsMap } = compilation.module;

  for (const { name, importUrlH5 } of wxsMap.values()) {
    if (!importUrlH5) {
      continue;
    }
    const importNode = importDeclaration(
      [importDefaultSpecifier(identifier(name))],
      stringLiteral(`${importUrlH5}.js`)
    );
    path.node.body.unshift(importNode);
  }

  const libraries = {};

  const h5Components = jsonConfig.h5Components || {};
  for (const key in h5Components) {
    const { tag, src, defaultExport = true } = h5Components[key];
    if (!src) {
      continue;
    }
    if (defaultExport) {
      const importNode = importDeclaration(
        [importDefaultSpecifier(identifier(tag))],
        stringLiteral(src)
      );
      path.node.body.unshift(importNode);
    } else {
      const comps = libraries[src];
      if (!comps) {
        libraries[src] = new Set();
      }
      libraries[src].add(tag);
    }
  }
  for (const [name, includeComponent] of includeComponentsMap.entries()) {
    const { from, namedAs, defaultExport } = includeComponent;
    if (defaultExport) {
      const importNode = importDeclaration(
        [importDefaultSpecifier(identifier(namedAs || name))],
        stringLiteral(from)
      );
      path.node.body.unshift(importNode);
    } else {
      const comps = libraries[from];
      if (!comps) {
        libraries[from] = new Set();
      }
      libraries[from].add(namedAs || name);
    }
  }

  Object.keys(libraries).forEach((library) => {
    const comps = Array.from(libraries[library]).join(', ');
    path.node.body.unshift(
      expressionStatement(identifier(`import { ${comps} } from '${library}'`))
    );
  });
}

export default class JsxGeneratorPlugin implements Plugin {
  name = 'JsxGeneratorPlugin';

  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap(this.name, (compilation) => {
      compilation.hooks.processAssets.tapPromise(
        this.name,
        async (compilation) => {
          try {
            const { module } = compilation;
            const jsPath = module.jsPath;

            const file = await compilation.fileResolver.resolveFile(
              jsPath,
              'js'
            );

            let jsxContent = compilation.context.templateJsxContent || '';
            jsxContent = `<div className="matrix-component__${compilation.module.name}" ref={this.$matrixRef}>
      { this.state.styleInjections && this.state.styleInjections.map((item,i) => <style key={i}>{item}</style>) }

      ${jsxContent}
    </div>`;

            await compilation.hooks.transform
              .for('js')
              ?.promise(file.content, file.filePath, file);

            const jsxCode = this.generateJsxCode(
              compilation,
              file.content as File,
              jsxContent
            );

            // console.log('jsxCode:\n', jsxCode);
            const asset = new AssetJsx(compilation, jsPath, jsxCode);
            compilation.addAsset(asset.outputPath, asset);
          } catch (err) {
            logger.error(
              `[${compilation.module.name}][${this.name}] generate jsx code error: ${err.message}`
            );
            throw err;
          }
        }
      );
    });
  }

  generateJsxCode(compilation: Compilation, ast: File, jsxContent: string) {
    const { miniModuleNode, outerNodes } = this.componentAstSplit(
      compilation,
      ast
    );

    const jsxAst: File = createComponentTemplateAst();
    this.insertOuterNodes(jsxAst, outerNodes);
    this.jsxTransform(compilation, jsxAst, miniModuleNode, jsxContent);

    const jsxCode: string = generate(jsxAst, {
      comments: true
    }).code;

    return jsxCode;
  }

  jsxTransform(
    compilation: Compilation,
    ast: File,
    miniModuleNode: Expression | undefined,
    jsxContent: string
  ) {
    const enterVisitor: Visitor = {
      ClassDeclaration: function (path) {
        const componentName = compilation.module.name;
        path.node.id.name =
          componentName.slice(0, 1).toUpperCase() + componentName.slice(1);
      },
      ClassMethod: function (path) {
        if (isIdentifier(path.node.key) && path.node.key.name === 'render') {
          const { entryAddThisDataCollector } = compilation.context;
          if (!jsxContent) {
            return;
          }
          try {
            const templateAst = parseExpression(jsxContent, {
              plugins: ['jsx']
            });
            path.node.body.body[0] = returnStatement(templateAst);

            const idStr = [...entryAddThisDataCollector].join(', ');
            const thisDataNode = template(`
            const { wmrt } = this.props;
            const { ${idStr} } = this.data;
            `)();
            path.node.body.body.unshift(...thisDataNode);
          } catch (err) {
            console.error(err);
            logger.error(`[${compilation.module.name}][JsxGeneratorPlugin babel.parse templateJsxContent] ${err.reasonCode}: \`${jsxContent}\`
        Possible reasons are:
          This expression includes keywords or reserved keywords in javascript, such as function var const let switch for in break...
          This expression includes unmatched quotes with double or single.
          This is not a correct expression for javascript.`);
            throw err;
          }
        }
        if (
          isIdentifier(path.node.key) &&
          path.node.key.name === 'componentDidMount'
        ) {
          const { cssMap } = compilation.context;
          try {
            let idx = 0;
            for (const { name } of cssMap.values()) {
              const styleInjectionsNode = template(`
                  const cssModule${idx} = ${name}
                  if (cssModule${idx}) {
                    this.setData({
                      styleInjections: this.data.styleInjections.concat(cssModule${idx}(this.props.wmrt.rem))
                    })
                  }
              `)();
              ++idx;
              path.node.body.body.push(...styleInjectionsNode);
            }
          } catch (err) {
            logger.error(
              `[${compilation.module.name}][JsxGeneratorPlugin componentDidMount] ${err.message}`
            );
            throw err;
          }
        }
      },
      ExportDefaultDeclaration: function (path) {
        const declaration = path.node.declaration;
        if (
          isCallExpression(declaration) &&
          isCallExpression(declaration.callee) &&
          isIdentifier(declaration.callee.callee) &&
          declaration.callee.callee.name === 'withWeapp'
        ) {
          const componentName = compilation.module.name;
          declaration.arguments.forEach((argument) => {
            if (
              isIdentifier(argument) &&
              argument.name === 'TemplateComponent'
            ) {
              argument.name =
                componentName.slice(0, 1).toUpperCase() +
                componentName.slice(1);
            }
          });
        }
      },
      VariableDeclarator: function (path) {
        const isProgram = path.parentPath.parentPath?.isProgram();
        if (!isProgram) return;
        if (
          isIdentifier(path.node.id) &&
          path.node.id.name === 'withWeappOptions'
        ) {
          path.node.init = miniModuleNode;
        }
      },
      JSXElement: {
        enter(path) {
          const openingElement = path.get('openingElement');
          const jsxName = openingElement.get('name');
          const attrs = openingElement.get('attributes');
          if (!jsxName.isJSXIdentifier()) {
            return;
          }

          const slotAttr = attrs.find(
            (a) =>
              isJSXAttribute(a.node) &&
              isJSXIdentifier(a.node.name) &&
              a.node.name.name === 'slot'
          );
          if (slotAttr && isJSXAttribute(slotAttr.node)) {
            const slotValue = slotAttr.node.value;
            if (slotValue && isStringLiteral(slotValue)) {
              const slotName = slotValue.value;
              const parentComponent = path.findParent(
                (p) =>
                  p.isJSXElement() &&
                  isJSXIdentifier(p.node.openingElement.name)
              );
              if (
                parentComponent &&
                parentComponent.isJSXElement() &&
                isJSXIdentifier(parentComponent.node.openingElement.name)
              ) {
                slotAttr.remove();
                const block = jsxElement(
                  jsxOpeningElement(jsxIdentifier('React.Fragment'), []),
                  jsxClosingElement(jsxIdentifier('React.Fragment')),
                  []
                );
                block.children = [cloneDeep(path.node)];
                parentComponent.node.openingElement.attributes.push(
                  jsxAttribute(
                    jsxIdentifier(`slot${strike2camelCase(slotName)}`),
                    jsxExpressionContainer(block)
                  )
                );
                path.remove();
              }
            } else {
              logger.error(
                `[${compilation.module.name}][JsxGeneratorPlugin] slot 的值必须是一个字符串：${slotValue}`
              );
            }
          }

          const tagName = jsxName.node.name;
          if (tagName === 'Slot') {
            const nameAttr = attrs.find(
              (a) =>
                isJSXAttribute(a.node) &&
                isJSXIdentifier(a.node.name) &&
                a.node.name.name === 'name'
            );
            let slotName = '';
            if (nameAttr) {
              if (
                isJSXAttribute(nameAttr.node) &&
                nameAttr.node.value &&
                isStringLiteral(nameAttr.node.value)
              ) {
                slotName = nameAttr.node.value.value;
              } else {
                logger.error(
                  `[${compilation.module.name}][JsxGeneratorPlugin] ${nameAttr.node} slot 的值必须是一个字符串。`
                );
              }
            }
            const children = memberExpression(
              memberExpression(thisExpression(), identifier('props')),
              identifier(
                slotName ? `slot${strike2camelCase(slotName)}` : 'children'
              )
            );
            try {
              path.replaceWith(
                path.parentPath.isJSXElement()
                  ? jsxExpressionContainer(children)
                  : children
              );
            } catch (error) {
              //
            }
          }
        }
      }
    };

    const exitFunc = (path: NodePath<Program>) => {
      const { cssMap, templateMap } = compilation.context;

      for (const { name, importUrl } of cssMap.values()) {
        const importNode = importDeclaration(
          [importDefaultSpecifier(identifier(name))],
          stringLiteral(`./${importUrl}`)
        );
        path.node.body.unshift(importNode);
      }

      commonImportDeclarationAdd(compilation, path);

      for (const { componentName, importUrl } of templateMap.values()) {
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

  componentAstSplit(compilation: Compilation, ast: File) {
    const outerNodes = this.spliceOuterNodes(ast);
    let miniModuleNode: Expression | undefined;

    traverse(ast, {
      ExpressionStatement: function (path) {
        try {
          const { node } = path;
          if (
            isMiniConstructor(node) &&
            isExpressionStatement(node) &&
            isCallExpression(node.expression) &&
            isExpression(node.expression.arguments[0])
          ) {
            miniModuleNode = node.expression.arguments[0];
          }
        } catch (e) {
          logger.error(
            `[C:${compilation.module.name}][JsxVisitor ExpressionStatement] ${e.message}`
          );
          throw e;
        }
      }
    });

    return {
      miniModuleNode,
      outerNodes
    };
  }

  spliceOuterNodes(programAst: File) {
    const body = programAst.program.body || [];
    const outerNodes: Statement[] = [];
    for (let i = 0; i < body.length; i++) {
      const node = body[i];
      if (!isMiniConstructor(node)) {
        outerNodes.push(node);
        body.splice(i, 1);
        i--;
      }
    }
    return outerNodes;
  }

  insertOuterNodes(ast: File, outerNodes: Statement[]) {
    const body = ast.program.body || [];
    for (let i = 0; i < body.length; i++) {
      const node = body[i];
      if (isImportDeclaration(node)) continue;
      body.splice(i, 0, ...outerNodes);
      break;
    }
  }
}
