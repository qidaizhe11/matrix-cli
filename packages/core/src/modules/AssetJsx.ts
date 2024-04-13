import Compilation from '../Compilation';
import AssetBase from './AssetBase';

export default class AssetJsx extends AssetBase {
  assetType: string;
  assetExtname: string;

  constructor(compilation: Compilation, absPath: string, content: string) {
    super(compilation, 'plain', absPath, content);
    this.assetType = 'Jsx';
    this.assetExtname = '.tsx';
  }
}
