// 打印帮助信息
export default function help(program) {
  program.on('--help', () => {
    console.log();
    console.log('Examples:');
    console.log('  Build miniprogram component to h5 component:');
    console.log('    $ matrix -o ../web');
    console.log('  Build design-platform component to h5:');
    console.log('    $ matrix design');
    console.log('  Build design-platform library to h5:');
    console.log('    $ matrix design-library');
  });
}
