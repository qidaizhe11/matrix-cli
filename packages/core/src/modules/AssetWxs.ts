import { logger } from '@matrix/utils';
import fse from 'fs-extra';
import Compilation from '../Compilation';
import AssetBase, { AssetContentType } from './AssetBase';

export default class AssetWxs extends AssetBase {
  assetType: string;
  assetExtname: string;

  constructor(
    compilation: Compilation,
    contentType: AssetContentType,
    absPath: string,
    content: string
  ) {
    super(compilation, contentType, absPath, content);
    this.assetExtname = '.wxs.js';
    this.assetType = 'Wxs';

    if (this.contentType !== 'plain') {
      this.content = fse.readFileSync(this.absPath, 'utf-8');
    }
  }

  // 创建文件
  plain(resolve, reject) {
    this.writeFile(resolve, reject, 'plain');
  }

  // 拷贝文件
  copy(resolve, reject) {
    this.writeFile(resolve, reject, 'copy');
  }

  writeFile(resolve, reject, opt) {
    fse.writeFile(this.outputPath, this.content, 'utf-8', (err) => {
      if (err) {
        logger.error(
          `[${this.compilation.module.name}][AssetWxs ${opt}] ${err.message}`
        );
        return reject(err);
      }
      resolve();
      logger.success(
        `[${this.compilation.module.name}][AssetWxs ${opt}] ${this.outputPath}`
      );
    });
  }

  // 更新内容
  setContent(content) {
    this.content = content;
  }
}
