import pathLib from 'path';
import Compilation from '../Compilation';
import AssetBase from './AssetBase';

export default class AssetJs extends AssetBase {
  assetType: string;
  assetExtname: string;

  constructor(compilation: Compilation, absPath: string, content: string) {
    super(compilation, 'plain', absPath, content);
    this.assetType = 'Js';
    this.assetExtname = pathLib.extname(absPath);
  }
}
