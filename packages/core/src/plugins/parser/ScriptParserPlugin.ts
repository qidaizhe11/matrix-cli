import generate from '@babel/generator';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import {
  Node,
  identifier,
  importDeclaration,
  importSpecifier,
  isArrayPattern,
  isAssignmentExpression,
  isAssignmentPattern,
  isExportAllDeclaration,
  isExportNamedDeclaration,
  isImportDeclaration,
  memberExpression,
  stringLiteral,
  traverseFast
} from '@babel/types';
import { logger } from '@matrix/utils';
import conditionalCompilation from '../conditional-compilation';
import fse from 'fs-extra';
import pathLib from 'path';
import Compilation from '../../Compilation';
import { File, FileDependency, buildLoadResult } from '../../FileResolver';
import type { Compiler } from '../../compiler';
import { SCOPED_ENV_NAME, SCOPED_IDENTIFIERS } from '../../constants';
import AssetJs from '../../modules/AssetJs';
import { Plugin } from '../../plugin';

export default class ScriptParserPlugin implements Plugin {
  name = 'ScriptParserPlugin';

  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap(this.name, (compilation) => {
      compilation.hooks.loadFile
        .for('js')
        .tapPromise(this.name, async (filePath) => {
          return this.loadFile(compilation, filePath);
        });

      compilation.hooks.transform
        .for('js')
        .tapPromise(this.name, async (ast, filePath) => {
          try {
            this.transform(compilation, ast);
            return ast;
          } catch (err) {
            logger.error(
              `[${compilation.module.name}][${this.name}] transform error! ${err.message}`
            );
            throw err;
          }
        });

      compilation.hooks.transformToString
        .for('js')
        .tapPromise(this.name, async (ast, filePath) => {
          const jsCode = generate(ast, {
            comment: true
          }).code;

          return jsCode;
        });

      compilation.hooks.processFile
        .for('js')
        .tapPromise(this.name, async (contents, filePath, file) => {
          const assetJs = new AssetJs(
            compilation,
            filePath,
            contents as string
          );
          compilation.addAsset(assetJs.outputPath, assetJs);
        });

      compilation.hooks.collectDependencies
        .for('js')
        .tapPromise(this.name, async (dependencies, file) => {
          await this.collectDependencies(compilation, dependencies, file);
        });
    });
  }

  async loadFile(compilation: Compilation, filePath: string) {
    try {
      if (!fse.existsSync(filePath)) {
        const error = new Error(
          `[${compilation.module.name}][${this.name}] wxjs path not exists: ${filePath}`
        );
        logger.error(error.message);
        throw error;
      }
      let data = await fse.readFile(filePath, { encoding: 'utf8' });
      data = conditionalCompilation(data, {
        commentType: 'line',
        conditions: compilation.compiler.conditionDefinitions,
        keepMismatch: true
      });
      const ast = this.jsParse(compilation, data);
      return buildLoadResult(ast, data);
    } catch (err) {
      logger.error(
        `[${compilation.module.name}][${this.name}] loadFile error: ${err.message}`
      );
      throw err;
    }
  }

  transform(compilation, ast) {
    let needInsertImportBehavior = false;
    let hasScoped = false;
    const scopedIdentifier = identifier(SCOPED_ENV_NAME);
    const scopedIdentifiers = new Set(SCOPED_IDENTIFIERS);
    traverse(ast, {
      Program: {
        enter(path) {
          path.traverse({
            CallExpression(path) {
              const calleePath = path.get('callee');
              const callee = calleePath.node;
              // Behavior 声明转换
              if (callee.type === 'Identifier') {
                if (callee.name === 'Behavior') {
                  needInsertImportBehavior = true;
                }
              }
            },
            Identifier(path) {
              const { node, parent } = path;
              const { name } = node;
              // 部分全局变量沙箱化
              if (
                scopedIdentifiers.has(name) &&
                (path.isReferencedIdentifier() ||
                  isAssignmentExpression(parent) ||
                  isAssignmentPattern(parent) ||
                  isArrayPattern(parent)) &&
                !path.scope.hasBinding(name, true)
              ) {
                hasScoped = true;
                path.replaceWith(memberExpression(scopedIdentifier, node));
              }
            }
          });
        },
        exit(path) {
          if (needInsertImportBehavior) {
            path.node.body.unshift(
              importDeclaration(
                [
                  importSpecifier(
                    identifier('Behavior'),
                    identifier('Behavior')
                  )
                ],
                stringLiteral('@matrix/runtime')
              )
            );
          }
          if (hasScoped) {
            path.node.body.unshift(
              importDeclaration(
                [importSpecifier(identifier('_$_'), identifier('_$_'))],
                stringLiteral('@matrix/runtime')
              )
            );
          }
        }
      }
    });
  }

  jsParse(compilation: Compilation, fileContent: string) {
    try {
      const ast = parse(fileContent, {
        sourceType: 'unambiguous',
        plugins: ['typescript']
      });
      return ast;
    } catch (e) {
      logger.error(`[${compilation.module.name}][jsParse] ${e.message}`);
      throw e;
    }
  }

  async collectDependencies(
    compilation: Compilation,
    dependencies: Set<FileDependency>,
    file: File
  ) {
    const deps = this.collectJsDependencies(file.content as Node);
    const { filePath } = file;
    const parentDir = pathLib.dirname(filePath);

    await Promise.all(
      deps.map(async ([src, stringLiteral]) => {
        const jsPath = await compilation.fileResolver.resolveEntry(src, {
          basedir: parentDir,
          extensions: ['.ts', '.js']
        });
        if (jsPath) {
          const jsFile = await compilation.fileResolver.resolveFile(
            jsPath,
            'js'
          );

          if (jsFile) {
            dependencies.add(jsFile);
          }
        }
      })
    );

    // console.log('dependencies:', dependencies)
  }

  collectJsDependencies = (
    ast: Node
  ): [filePath: string, fileName: string][] => {
    const dependencies: any = [];
    if (!ast) {
      return dependencies;
    }
    traverseFast(ast, (node) => {
      if (
        (isImportDeclaration(node) ||
          isExportAllDeclaration(node) ||
          isExportNamedDeclaration(node)) &&
        node.source
      ) {
        dependencies.push([node.source.value, node.source]);
      }
    });
    // console.log('dependencies:', dependencies)
    return dependencies;
  };
}
