import chalk from 'chalk';
import suggestCommands from './suggest';

/**
 * 未知的命令
 * 1. 给出相近的命令提示
 * 2. 列出所有帮助信息
 */
export default function unknownCommand(cmd, program) {
  console.log(chalk.red(`Unknown command: ${chalk.yellow(cmd)}`));
  suggestCommands(cmd, program);
  console.log();
  console.log(
    `  Run ${chalk.cyan(`matrix --help`)} for a list of available commands. \n`
  );
  program.outputHelp();
  process.exit(1);
}
