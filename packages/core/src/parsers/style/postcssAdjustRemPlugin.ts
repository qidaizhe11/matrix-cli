function replaceStyleRem(value) {
  if (/\d+(rpx|px)/.test(value)) {
    return value.replace(/(\d+)(rpx|px)/g, (all, number, unit) => {
      return '${' + `rem("${number + unit}")` + '}';
    });
  }
  return value;
}

/*
 * 调整 rem
 */
export default () => {
  return {
    postcssPlugin: 'postcss-adjust-rem',
    Once(root, { result }) {
      root.walkRules((rule) => {
        rule.walkDecls((decl) => {
          decl.value = replaceStyleRem(decl.value);
        });
      });
    }
  };
};
