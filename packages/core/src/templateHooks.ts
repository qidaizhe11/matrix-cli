import { ChildNode, Comment, Element, ParentNode, Text } from 'domhandler';
import { SyncBailHook, SyncHook, SyncWaterfallHook } from 'tapable';
import type Compilation from './Compilation';

export interface AttributeOrigin {
  /**
   * 属性名称
   */
  key: string;

  /**
   * 属性值
   */
  value: string;
}

export interface AttributeInfo {
  /**
   * 属性名称
   */
  attrName: string;

  /**
   * 属性值
   */
  attrValue: string;

  /**
   * 属性 key 标记
   */
  matrixKey?: string;

  /**
   * 属性移除标记
   */
  removeAttribute?: boolean;

  /**
   * 属性值 (attrValue) 无需外侧引号
   */
  removeQuotes?: boolean;
}

/**
 * 节点 collector
 */
export interface NodeCollector {
  directives: Record<string, string | [string, string]>;

  conditions_children: AttributeInfo[];

  variables: Record<string, string>;
}

type Parent = ParentNode & {
  /**
   * 节点信息 collector
   */
  collector?: NodeCollector;
};

interface NodeExtra {
  /**
   * 节点输出文本
   */
  content?: string;

  /**
   * 转换后的 tag 标签名称
   */
  h5Name?: string;

  /**
   * 自闭合标签
   */
  isSingleTag?: boolean;

  /**
   * 节点信息 collector
   */
  collector?: NodeCollector;

  /**
   * 属性转换后结果
   */
  attrContent?: string;

  parent: Parent | null;

  /**
   * 节点唯一 key，用于标识节点
   */
  matrixKey?: string;
}

export type ElementNode = Element & NodeExtra;

export type TextNode = Text & NodeExtra;

export type TemplateNode = ChildNode & NodeExtra;

export type CommentNode = Comment & NodeExtra;

export type TagTransformFunction = (
  Compilation: Compilation,
  elem: ElementNode
) => string;

export type TagTransforms = Record<string, TagTransformFunction>;

export type AttributesOrigin = {
  [name: string]: string;
};

export interface TemplateHooks {
  /**
   * 注入其他标签替换逻辑
   */
  tagRule: SyncHook<[Compilation, TagTransforms]>;

  /**
   * 标签替换
   */
  tagName: SyncHook<[Compilation, ElementNode]>;

  /**
   * 属性转换
   */
  attributes: SyncHook<[Compilation, ElementNode]>;

  /**
   * 属性转换
   */
  attribute: SyncBailHook<
    [compilation: Compilation, attr: AttributeOrigin, elem: ElementNode],
    AttributeInfo | void
  >;

  /**
   * 指令替换
   */
  directives: SyncWaterfallHook<
    [tagContent: string, compilation: Compilation, elem: ElementNode]
  >;

  /**
   * 文本节点转换
   */
  textNode: SyncHook<[Compilation, TextNode]>;
}

/**
 * 节点 collector 初始化
 */
export function initNodeCollector(): NodeCollector {
  return {
    conditions_children: [],
    directives: {},
    variables: {}
  };
}

export function createTemplateHooks() {
  const hooks: TemplateHooks = {
    tagRule: new SyncHook(['compilation', 'transforms']),

    tagName: new SyncHook(['compilation', 'elem']),

    attributes: new SyncHook(['compilation', 'elem']),

    attribute: new SyncBailHook(['compilation', 'attr', 'elem']),

    directives: new SyncWaterfallHook(['tag', 'compilation', 'elem']),

    textNode: new SyncHook(['compilation', 'elem'])
  };

  return hooks;
}
