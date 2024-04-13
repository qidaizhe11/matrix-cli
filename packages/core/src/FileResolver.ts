import fse from 'fs-extra';
import pathLib from 'path';
import resolveLib from 'resolve';

import { MAYBE_NPM_PATH, normalizePath } from '@matrix/utils';
import type Compilation from './Compilation';

/**
 * 模块文件对象
 */
export interface File {
  /**
   * 文件路径
   */
  readonly filePath: string;

  /**
   * 文件类型
   */
  readonly fileType: string | void;

  /**
   * 文件内容
   */
  content?: unknown;

  /**
   * 原始文件内容
   */
  source?: string | null;

  /**
   * 文件的一些元数据
   */
  readonly meta: Record<string, unknown>;
}

export type FileDependency = File | string;

export interface LoadFileResultOrigin<T = unknown> {
  content: T;

  source?: string | null;
}

export interface LoadResult<T = unknown> {
  content: T;

  source: string | null;

  /**
   * @internal
   */
  $$loadResult$$: true;
}

const resolveAsync = (filePath, options): Promise<string | undefined> =>
  new Promise((resolve) => {
    resolveLib(filePath, options, (err, resolved) => {
      if (err) {
        resolve(undefined);
      } else {
        resolve(resolved);
      }
    });
  });

export const isLoadResult = (val: unknown): val is LoadResult =>
  val && typeof val === 'object' && (val as any).$$loadResult$$;

export const buildLoadResult = <T = unknown>(
  content: T,
  originalSource: string | null
): LoadResult<T> => ({
  content,
  source: originalSource ?? null,
  $$loadResult$$: true
});

export default class FileResolver {
  compilation: Compilation;

  constructor(compilation: Compilation) {
    this.compilation = compilation;
  }

  async resolveFile(
    fileAbsPath: string,
    fileType: string
  ): Promise<File> {
    try {
      fileAbsPath = normalizePath(fileAbsPath);

      const result: File = {
        filePath: fileAbsPath,
        fileType,
        meta: {}
      };

      if (fileType) {
        const loadResult = await this.loadFileSourceAndContent(
          fileAbsPath,
          fileType
        );

        if (loadResult) {
          result.content = loadResult.content;
          result.source = loadResult.source;
        }
      }

      return result;
    } catch (err) {
      console.error(`处理文件 ${fileAbsPath} 失败！`, err);
      throw err;
    }
  }

  async loadFileSourceAndContent(filePath: string, fileType: string) {
    const result = await this.compilation.hooks.loadFile
      .get(fileType)
      ?.promise(filePath);
    if (isLoadResult(result)) {
      return result;
    }
    return buildLoadResult(result, null);
  }

  async resolveEntry(entryPath: string, options) {
    // /miniprogram_npm 开头路径，解析流程：
    // 1. 去除 /miniprogram_npm 开头
    // 2. 从 node_modules 寻找 npm 包
    // 3. 解析 npm 包下 package.json 中 miniprogram 字段，拼接至路径中间
    // 解析结果：node_modules/${npmName}/${package.json.miniprogram}/${relativePath}
    if (entryPath.startsWith('/miniprogram_npm')) {
      const splited = entryPath.split('/');

      // npm 包名称
      let npmName = '';
      // 文件相对路径
      let relativePath = '';
      // npm 包配置的 miniprogram 路径
      let miniprogramSrc = '';

      if (splited[2].startsWith('@')) {
        npmName = `${splited[2]}/${splited[3]}`;
        relativePath = splited.slice(4).join('/');
      } else {
        npmName = splited[2];
        relativePath = splited.slice(3).join('/');
      }

      const npmPackageJsonPath = await resolveAsync(`${npmName}/package.json`, {
        basedir: options.basedir
      });
      if (npmPackageJsonPath) {
        const packageJson = fse.readJSONSync(npmPackageJsonPath);
        if (packageJson && packageJson.miniprogram) {
          miniprogramSrc = packageJson.miniprogram;
        }

        const realPath = pathLib.join(
          pathLib.dirname(npmPackageJsonPath),
          miniprogramSrc,
          relativePath
        );

        return resolveAsync(realPath, options);
      }
    }
    if (!MAYBE_NPM_PATH.test(entryPath)) {
      return resolveAsync(entryPath, options);
    }
    return resolveAsync(`./${entryPath}`, options).then((res) => {
      if (res || options.type !== 'script') {
        return res;
      }
      return resolveAsync(entryPath, options);
    });
  }
}
