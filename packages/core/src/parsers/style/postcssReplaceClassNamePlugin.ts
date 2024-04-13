import selectorParser from 'postcss-selector-parser';

export default (componentName) => {
  return {
    postcssPlugin: 'postcss-replace-class-name',
    Once(root, { result }) {
      root.walkRules((rule) => {
        // parse 选择器为 AST
        const parsedSelector = selectorParser().astSync(rule);
        // 遍历选择器 AST 并实现转换
        rule.selector = traverseNode(
          parsedSelector.clone({}),
          componentName
        ).toString();
      });
    }
  };
};

function traverseNode(node, componentName) {
  switch (node.type) {
    case 'root':
    case 'selector': {
      node.each((item) => traverseNode(item, componentName));
      break;
    }
    case 'id':
    case 'class': {
      if (componentName) {
        node.value = node.value + '__' + componentName;
      }
      break;
    }
    case 'pseudo': {
      if (node.value === '::part') {
        node.each((item) => traversePartNode(item, componentName));
      }
      break;
    }
  }
  return node;
}

function traversePartNode(node, componentName) {
  switch (node.type) {
    case 'selector': {
      node.each((item) => traversePartNode(item, componentName));
      break;
    }
    case 'tag': {
      if (componentName) {
        node.value = node.value + '__' + componentName;
      }
      break;
    }
  }
  return node;
}
