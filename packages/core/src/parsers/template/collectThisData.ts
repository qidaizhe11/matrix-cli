import {
  BinaryExpression,
  CallExpression,
  ConditionalExpression,
  Identifier,
  LogicalExpression,
  MemberExpression,
  ObjectExpression,
  ObjectProperty,
  UnaryExpression,
  isIdentifier
} from '@babel/types';

const handlerMap = new Map();
handlerMap.set('Identifier', handleIdentifier);
handlerMap.set('MemberExpression', handleMemberExpression);
handlerMap.set('BinaryExpression', handleBinaryExpression);
handlerMap.set('ConditionalExpression', handleConditionalExpression);
handlerMap.set('LogicalExpression', handleLogicalExpression);
handlerMap.set('UnaryExpression', handleUnaryExpression);
handlerMap.set('CallExpression', handleCallExpression);
handlerMap.set('ObjectExpression', handleObjectExpression);
handlerMap.set('ObjectProperty', handleObjectProperty);

/**
 * 需要加`this.data.`前缀的节点收集
 */
export interface ThisDataCollect {
  /**
   * babel 节点
   */
  node: Identifier;
  /**
   * this.data 下展示名称
   */
  thisData: string;
}

/**
 * 收集需要加`this.data.`前缀的节点
 * @param ast babel 节点
 * @param collector 需要加`this.data.`前缀的节点
 */
function next(ast, collector: ThisDataCollect[]) {
  if (ast && handlerMap.has(ast.type)) {
    const handler = handlerMap.get(ast.type);
    handler(ast, collector);
  }
}

function handleIdentifier(ast: Identifier, collector: ThisDataCollect[]) {
  collector.push({
    node: ast,
    thisData: ast.name
  });
}

function handleMemberExpression(
  ast: MemberExpression,
  collector: ThisDataCollect[]
) {
  if (isIdentifier(ast.object)) {
    collector.push({
      node: ast.object,
      thisData: ast.object.name
    });
    // 举例：{{ iconfont[gm_img] }} 收集 gm_img
    if (ast.computed && isIdentifier(ast.property)) {
      collector.push({
        node: ast.property,
        thisData: ast.property.name
      });
    }
  } else {
    next(ast.object, collector);
  }
}

function handleBinaryExpression(
  ast: BinaryExpression,
  collector: ThisDataCollect[]
) {
  next(ast.left, collector);
  next(ast.right, collector);
}

function handleConditionalExpression(
  ast: ConditionalExpression,
  collector: ThisDataCollect[]
) {
  next(ast.test, collector);
  next(ast.consequent, collector);
  next(ast.alternate, collector);
}

function handleLogicalExpression(
  ast: LogicalExpression,
  collector: ThisDataCollect[]
) {
  next(ast.left, collector);
  next(ast.right, collector);
}

function handleUnaryExpression(
  ast: UnaryExpression,
  collector: ThisDataCollect[]
) {
  next(ast.argument, collector);
}

function handleCallExpression(
  ast: CallExpression,
  collector: ThisDataCollect[]
) {
  if (ast.arguments.length > 0) {
    ast.arguments.forEach((argument) => {
      next(argument, collector);
    });
  }
}

function handleObjectExpression(
  ast: ObjectExpression,
  collector: ThisDataCollect[]
) {
  if (ast.properties.length > 0) {
    ast.properties.forEach((property) => {
      next(property, collector);
    });
  }
}

function handleObjectProperty(
  ast: ObjectProperty,
  collector: ThisDataCollect[]
) {
  next(ast.value, collector);
}

export default next;
