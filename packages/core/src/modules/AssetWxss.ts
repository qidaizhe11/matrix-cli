import Compilation from '../Compilation';
import AssetBase from './AssetBase';

export default class AssetWxss extends AssetBase {
  assetType: string;
  assetExtname: string;

  constructor(compilation: Compilation, absPath: string, content: string) {
    super(compilation, 'plain', absPath, content);
    this.assetType = 'Css';
    this.assetExtname = '.css.js';
  }
}
