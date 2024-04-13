import H5ComponentsGeneratorPlugin from './H5ComponentsGeneratorPlugin';
import JsxGeneratorPlugin from './JsxGeneratorPlugin';
import LibraryGeneratorPlugin from './LibraryGeneratorPlugin';
import StyleGeneratorPlugin from './StyleGeneratorPlugin';
import TemplateGeneratorPlugin from './TemplateGeneratorPlugin';
import WxsGeneratorPlugin from './WxsGeneratorPlugin';

export const componentGeneratorPlugins = [
  new JsxGeneratorPlugin(),
  new TemplateGeneratorPlugin(),
  new StyleGeneratorPlugin(),
  new H5ComponentsGeneratorPlugin(),
  new WxsGeneratorPlugin()
];

export const libraryGeneratorPlugins = [
  new WxsGeneratorPlugin(),
  new LibraryGeneratorPlugin()
];
