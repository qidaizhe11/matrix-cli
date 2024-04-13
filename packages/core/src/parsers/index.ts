import AttributeAndTextPlugin from './template/AttributeAndTextPlugin';
import AttributesPlugin from './template/AttributesPlugin';
import DirectivesPlugin from './template/DirectivesPlugin';
import TagNamePlugin from './template/TagNamePlugin';
import TagRuleH5ComponentsPlugin from './template/TagRuleH5ComponentsPlugin';

export const templateParserPlugins = [
  new TagRuleH5ComponentsPlugin(),
  new TagNamePlugin(),
  new AttributesPlugin(),
  new AttributeAndTextPlugin(),
  new DirectivesPlugin(),
];
