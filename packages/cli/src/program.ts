import { logger } from '@matrix/utils';
import { program } from 'commander';
import outputHelp from './help';
import parsePkgConfig from './parse-package-json';
import unknownCommand from './unknown';

import designCommand from './commands/design';

/**
 * 命令行工具主入口文件
 * 1. 检查用户的node版本
 * 2. 注册命令
 * 3. 解析命令行参数
 */

/**
 * 注册命令：小程序转换 h5
 */
const pkg = parsePkgConfig();

logger.info(`[@matrix/cli] version: ${pkg?.version}`);

program
  .version(`@matrix/cli ${pkg?.version}`)
  .description('小程序组件转换 h5')
  .usage('[options] <entry ...>')
  .option('--design', '装修组件转换为 h5')
  .option('--design-library', '装修 utils 等工具库组件转换为 h5')
  .option('--page-design', '系统页装修标识')
  .option('-o, --outdir <outdir>', '指定输出目录')
  .option('-w, --watch', 'watch 监听模式')
  .option('--wxml <entryWxml>', '指定入口 wxml（默认 index.wxml）')
  .action((options) => {
    if (options.design || options.designLibrary || options.pageDesign) {
      designCommand(options);
    }
  });

/**
 * 拦截未知的命令
 * 1. 给出相近的命令提示
 * 2. 列出所有帮助信息
 */
program.on('command:*', ([cmd]) => {
  unknownCommand(cmd, program);
});

// 打印帮助信息
outputHelp(program);

program.parse(process.argv);
