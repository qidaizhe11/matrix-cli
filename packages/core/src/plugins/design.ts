import {
  afterCompilationPlugins,
  componentBeforeCompilationPlugins
} from './compiler/index';

import { templateParserPlugins } from '../parsers';
import { componentGeneratorPlugins } from './generator';
import { componentParserPlugins } from './parser';

import CompilationStatsPlugin from './compilation/CompilationStatsPlugin';

export default [
  ...componentBeforeCompilationPlugins,
  ...componentParserPlugins,
  ...templateParserPlugins,
  ...componentGeneratorPlugins,
  new CompilationStatsPlugin(),
  ...afterCompilationPlugins
];
