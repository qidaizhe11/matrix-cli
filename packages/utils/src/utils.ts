/**
 * 首字母大写
 */
export function firstLetterUppercase(name: string) {
  if (!name) return name;
  return name.slice(0, 1).toUpperCase() + name.slice(1);
}

/**
 * 中划线转驼峰
 */
export function strike2camelCase(name: string) {
  let tagName = name;
  if (/-/.test(tagName)) {
    tagName = camelcase(tagName);
  }
  return firstLetterUppercase(tagName);
}

/**
 * camel-case
 */
export function camelcase(name) {
  return name
    .split('-')
    .map((item, i) =>
      i === 0 ? item : item.charAt(0).toUpperCase() + item.slice(1)
    )
    .join('');
}

/**
 * 将 px 和 rpx 转成 rem: wmrt.rem(rpx / 2)
 * @param content 输入内容
 * @param returnExp 返回 ${''} 表达式
 * @returns 转换后内容
 */
export function rpx2rem(content: string, returnExp: boolean): string {
  if (/(\d+)(rpx|px)/.test(content)) {
    return content.replace(/(\d+)(rpx|px)/g, (_, number, unit) => {
      const rem = 'this.props.wmrt.rem';
      if (returnExp) {
        return '${' + `${rem}("${number + unit}")` + '}';
      }
      return `${rem}("${number + unit}")`;
    });
  }
  return content;
}

export function fakeGuid(key = 'm') {
  function S4() {
    return (((1 + Math.random()) * 100000) | 0).toString(16).substring(1);
  }
  return key + (S4() + S4());
}
