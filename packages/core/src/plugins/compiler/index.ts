import CompilerEmitAssetsPlugin from './CompilerEmitAssetsPlugin';
import CompilerInitializePlugin from './CompilerInitializePlugin';
import CompilerStatsPlugin from './CompilerStatsPlugin';
import ComponentCompilerDistributionPlugin from './ComponentCompilerDistributionPlugin';
import ComponentCompilerEntryPlugin from './ComponentCompilerEntryPlugin';
import LibraryCompilerEntryPlugin from './LibraryCompilerEntryPlugin';

export const componentBeforeCompilationPlugins = [
  new CompilerInitializePlugin(),
  new ComponentCompilerEntryPlugin(),
  new ComponentCompilerDistributionPlugin()
];

export const libraryBeforeCompilationPlugins = [
  new CompilerInitializePlugin(),
  new LibraryCompilerEntryPlugin()
];

export const afterCompilationPlugins = [
  new CompilerEmitAssetsPlugin(),
  new CompilerStatsPlugin()
];
