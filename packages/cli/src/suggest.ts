import chalk from 'chalk';
import leven from 'leven';

// 建议的命令
export default function suggestCommands(unknownCommand, program) {
  const availableCommands = program.commands.map((cmd) => cmd._name);
  let suggestion;
  availableCommands.forEach((cmd) => {
    const isBestMatch =
      leven(cmd, unknownCommand) < leven(suggestion || '', unknownCommand);
    if (leven(cmd, unknownCommand) < 3 && isBestMatch) {
      suggestion = cmd;
    }
  });
  if (suggestion) {
    console.log(`  ` + chalk.red(`Did you mean ${chalk.yellow(suggestion)}?`));
  }
}
