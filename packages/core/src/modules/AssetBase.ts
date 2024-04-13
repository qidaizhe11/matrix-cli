import { changeExtname, logger } from '@matrix/utils';
import fse from 'fs-extra';
import pathLib from 'path';
import Compilation from '../Compilation';

export type AssetContentType = 'copy' | 'plain';

abstract class AssetBase {
  compilation: Compilation;

  /**
   * 文件内容类型
   */
  contentType: AssetContentType;

  root: string;

  outdir: string;

  entry: string;

  /**
   * 文件绝对路径
   */
  absPath: string;

  /**
   * 文件内容
   */
  content: string;

  /**
   * 文件类型
   */
  abstract assetType: string;

  /**
   * 文件后缀名
   */
  abstract assetExtname: string;

  constructor(
    compilation: Compilation,
    contentType: AssetContentType,
    absPath: string,
    content: string
  ) {
    this.compilation = compilation;
    this.root = compilation.compiler.options.root;
    this.outdir = compilation.compiler.options.outdir;
    this.entry = compilation.module.entry;
    /**
     * asset内容类型
     * plain: 可直接创建文件
     * copy: 复制文件内容
     */
    this.contentType = contentType; // 内容类型
    this.absPath = absPath;
    this.content = content; // code sourceUrl
  }

  get basePath() {
    try {
      return changeExtname(
        pathLib.relative(this.root, this.absPath),
        this.assetExtname
      );
    } catch (e) {
      logger.error(
        `[${this.compilation.module.name}][AssetBase basePath] ${e.message}`
      );
    }
    return '';
  }

  get importUrl() {
    return changeExtname(
      pathLib.relative(
        pathLib.resolve(this.compilation.module.absPath, '..'),
        this.absPath
      ),
      this.assetExtname
    );
  }

  get outputPath() {
    try {
      return pathLib.join(this.outdir, this.componentDir);
    } catch (e) {
      logger.error(
        `[${this.compilation.module.name}][AssetBase outputPath] ${e.message}`
      );
    }
    return '';
  }

  get componentDir() {
    try {
      const firstSlashIndex = this.basePath.indexOf(pathLib.sep);
      return this.basePath.slice(firstSlashIndex + 1);
    } catch (e) {
      logger.error(
        `[C:${this.compilation.module.name}][AssetBase componentDir] ${e.message}`
      );
    }
    return '';
  }

  // 写文件
  write(resolve, reject) {
    fse.ensureFile(this.outputPath).then(() => {
      if (this[this.contentType]) {
        this[this.contentType](resolve, reject);
      } else {
        logger.error(
          `[${this.compilation.module.name}][AssetBase${this.assetType} write] Unknown asset contentType: ${this.contentType}.`
        );
        reject(
          new Error(
            `[${this.compilation.module.name}][AssetBase${this.assetType} write] Unknown asset contentType: ${this.contentType}.`
          )
        );
      }
    });
  }

  // 创建文件
  plain(resolve, reject) {
    fse.writeFile(this.outputPath, this.content, 'utf-8', (err) => {
      if (err) {
        logger.error(
          `[${this.compilation.module.name}][AssetBase${this.assetType} plain] ${err.message}`
        );
        return reject(err);
      }
      resolve();
      logger.success(
        `[${this.compilation.module.name}][AssetBase${this.assetType} plain] ${this.outputPath}`
      );
    });
  }

  // 拷贝文件
  copy(resolve, reject) {
    fse.copy(this.content, this.outputPath, (err) => {
      if (err) {
        logger.error(
          `[C:${this.compilation.module.name}][AssetBase${this.assetType} copy] ${err.message}`
        );
        return reject(err);
      }
      resolve();
      logger.success(
        `[C:${this.compilation.module.name}][AssetBase${this.assetType} copy] ${this.outputPath}`
      );
    });
  }
}

export default AssetBase;
