import { logger } from '@matrix/utils';
import fse from 'fs-extra';
import path from 'path';

export default function parsePkgConfigs() {
  try {
    const pkgContent = fse.readFileSync(
      path.resolve(__dirname, '../package.json'),
      'utf-8'
    );
    const pkgJson = JSON.parse(pkgContent) || {};
    return {
      name: pkgJson.name,
      version: pkgJson.version,
      nodeVersion: pkgJson.engines.node
    };
  } catch (e) {
    logger.error(`[ParsePackageJson] ${e.message}`);
    console.error(e);
  }
}
