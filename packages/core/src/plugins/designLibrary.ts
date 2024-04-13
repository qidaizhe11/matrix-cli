import {
  afterCompilationPlugins,
  libraryBeforeCompilationPlugins
} from './compiler/index';

import { libraryGeneratorPlugins } from './generator';
import { libraryParserPlugins } from './parser';
import CompilationStatsPlugin from './compilation/CompilationStatsPlugin';

export default [
  ...libraryBeforeCompilationPlugins,
  ...libraryParserPlugins,
  ...libraryGeneratorPlugins,
  new CompilationStatsPlugin(),
  ...afterCompilationPlugins
];
