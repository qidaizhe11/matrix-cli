import ScriptParserPlugin from './ScriptParserPlugin';
import StyleParserPlugin from './StyleParserPlugin';
import TemplateParserPlugin from './TemplateParserPlugin';
import WxsParserPlugin from './WxsParserPlugin';

export const componentParserPlugins = [
  new TemplateParserPlugin(),
  new ScriptParserPlugin(),
  new StyleParserPlugin(),
  new WxsParserPlugin(),
];

export const libraryParserPlugins = [
  new ScriptParserPlugin(),
  new StyleParserPlugin(),
  new WxsParserPlugin(),
]
