/**
 * 默认 tag 标签转换规则
 * key: 小程序 tag.name，value: H5 tagName
 */
export const TAG_NAME_MAP = new Map([
  ['view', 'div'],
  ['text', 'span'],
  ['image', 'img'],
  ['block', 'React.Fragment'],
  ['button', 'button'],
  ['input', 'input'],
  ['video', 'video'],
  ['audio', 'audio'],
  ['a', 'a'],
  ['hr', 'hr'],
  ['slot', 'Slot']
]);

/**
 * 指令（这里特指会改变 jsx 结构的指令）
*/
export const DIRECTIVES_MAP = new Map([
  ['wx:if', 'if'],
  ['wx:elif', 'elif'],
  ['wx:else', 'else'],
  ['wx:for', 'for'],
])

/**
 * 指令优先级顺序
 */
export const DIRECTIVES_PRIORITY = [
  ['wx:for'],
  ['wx:for-item', 'wx:for-index'],
  ['wx:key'],
  ['wx:if']
];

/**
 * 属性需要特殊转化的
*/
export const ATTRS_MAP = new Map([
  ['class', 'className'],
  ['style', 'style'],
  ['id', 'id'],
  ['ext-class', 'extClass'],
  ['ext-style', 'extStyle'],
  ['extStyle', 'extStyle'],
  ['ref', 'ref'],
])

/**
 * 变量，在wx中是字符串，但其实是变量，需要特殊处理，而且要考虑变量是for循环的变量还是数据代码中的
 * wx:key="key" => key={key}
*/
export const VARIABLES_MAP = new Map([
  ['wx:key', 'key'],
  ['wx:for-index', 'index'],
  ['wx:for-item', 'item'],
])

/**
 * 特殊属性处理：删除属性（不需要生成到最终的jsxElements结构中）
*/
export const REMOVE_ATTRIBUTES = [
  'wx:for-index',
  'wx:for-item',
]

/**
 * 微信小程序事件 -> react组件事件
*/
export const EVENTS_MAP = new Map([
  ['bindtap', 'onClick'],
  ['bind:tap', 'onClick'],
  ['catchtap', 'onClick'],
  ['catch:tap', 'onClick'],
  ['bindinput', 'onChange'],
  ['bindtouchstart', 'onTouchStart'],
  ['bindtouchmove', 'onTouchMove'],
  ['bindtouchend', 'onTouchEnd'],
  ['bindtouchcancel', 'onTouchCancel'],
  ['bind:touchstart', 'onTouchStart'],
  ['bind:touchmove', 'onTouchMove'],
  ['bind:touchend', 'onTouchEnd'],
  ['bind:touchcancel', 'onTouchCancel'],
])
