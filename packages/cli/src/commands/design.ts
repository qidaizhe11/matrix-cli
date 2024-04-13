import core, { Compiler, CompilerOptions } from '@matrix/core';
import { initLogger, logger, strike2camelCase } from '@matrix/utils';
import chokidar from 'chokidar';
import pathLib from 'path';
import parsePkgConfig from '../parse-package-json';

/**
 * 命令行构建
 */
export default function commandBuild(options) {
  initLogger();
  const cwdPath = process.cwd();

  build({
    ...options,
    root: cwdPath
  });
}

export function cliBuild(options) {
  initLogger();
  const pkg = parsePkgConfig();
  logger.info(`[@matrix/cli] version: ${pkg?.version}`);

  build(options);
}

function build(options) {
  // options校验
  if (!options) {
    const errorMsg = `[Build checkOptionsValid] expected to be an object, but got ${
      options ? JSON.stringify(options) : options
    }`;
    logger.error(errorMsg);
    return;
  }

  let componentDirName: string = '';
  let entry: string = '.';
  if (options.noPackageJson) {
    componentDirName = pathLib.basename(options.root);
  } else {
    let pkg: any = {};
    try {
      pkg = require(pathLib.resolve(options.root, 'package.json'));
    } catch (error) {}
    if (!pkg) {
      logger.error(
        `[Build options] 该目录 ${options.root} 下不存在 package.json！请在组件根目录执行。`
      );
      return;
    }
    componentDirName = pkg.name.split('/')[1].replace('wx-', '');
    entry = pkg.miniprogram ? `./${pkg.miniprogram}` : '.';
  }

  const compilerOptions: CompilerOptions = {
    ...options,
    entry,
    design: true,
    entryWxml: options.wxml || 'index.wxml',
    outdir: options.outdir || `../../components-h5/${componentDirName}`,
    entryComponentName: componentDirName
      ? strike2camelCase(componentDirName)
      : ''
  };

  if (!pathLib.isAbsolute(compilerOptions.outdir)) {
    compilerOptions.outdir = pathLib.resolve(
      compilerOptions.root,
      compilerOptions.outdir
    );
  }

  logger.debug(`[Build options]`, logger.ENTRY, 'options', options);

  logger.debug(`[Build options]`, logger.EXIT, 'options', compilerOptions);

  const app = core(compilerOptions);

  if (compilerOptions.watch) {
    watchStart(app, app.options);
  }
}

function watchStart(app: Compiler, options: CompilerOptions) {
  const watcher = chokidar.watch(pathLib.resolve(options.root, options.entry), {
    ignored: /node_modules/,
    persistent: true,
    ignoreInitial: true
  });

  watcher.setMaxListeners(100);

  logger.info(`[Watcher] start.`);
  watcher.on('all', (type) => {
    if (type === 'change') {
      logger.info(`[Watcher] rebuild trigger.`);
      app.rebuild();
    }
  });
}
