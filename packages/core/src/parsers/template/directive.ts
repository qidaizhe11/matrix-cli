import { AttributeInfo, ElementNode } from '../../templateHooks';

export interface DirectiveOptions {
  key: string;

  item: string;

  index: string;
}

export type ExpOrFn = string | [string, string];

export class Directive {
  elem: ElementNode;

  dir: string;

  expOrFn: ExpOrFn;

  tag: string;

  result: string;

  options: DirectiveOptions;

  constructor(
    elem: ElementNode,
    dir: string,
    expOrFn: ExpOrFn,
    tag: string,
    options: DirectiveOptions
  ) {
    this.elem = elem;
    this.dir = dir;
    this.expOrFn = expOrFn;
    this.tag = tag;
    this.result = tag;
    this.options = options || {};
  }

  parse() {
    const fn = this.dir + 'Directive';
    if (this[fn]) this[fn]();
    else console.log(`无法识别的指令：${this.dir}`);
  }

  ifDirective() {
    this.result = `{ !!(${this.expOrFn}) && ( ${this.tag} ) }`;
  }

  elifDirective() {
    const ifExpStr = this.getSiblingsConditions()
      .filter((item) => item.attrName === 'if')
      .map(({ attrValue }) => `!(${attrValue})`)[0];
    this.result = `{ (${ifExpStr}) && (${this.expOrFn}) && ( ${this.tag} ) }`;
  }

  elseDirective() {
    if (this.expOrFn === '') {
      this.expOrFn = this.getSiblingsConditions()
        .map(({ attrValue }) => `!(${attrValue})`)
        .join(' && ');
    }
    this.result = `{ (${this.expOrFn}) && ( ${this.tag} ) }`;
  }

  forDirective() {
    this.result = `{ (${this.expOrFn}) && (${this.expOrFn}).map((${
      this.options.item || 'item'
    }, ${this.options.index || 'index'}) => (${this.tag})) }`;
  }

  forWithIfDirective() {
    const [forExp, ifExp] = this.expOrFn || [];
    this.result = `{ (${forExp}) && (${forExp}).map((${
      this.options.item || 'item'
    }, ${
      this.options.index || 'index'
    }) => (${ifExp}) && <React.Fragment key={${this.options.key}}> ${
      this.tag
    } </React.Fragment>) }`;
  }

  getSiblingsConditions() {
    const conditions =
      (this.elem &&
        this.elem.parent &&
        this.elem.parent.collector &&
        this.elem.parent.collector.conditions_children) ||
      [];
    const { matrixKey } = this.elem;
    if (!matrixKey) {
      return conditions;
    }
    const findIndex = conditions.findIndex(
      (item) => item.matrixKey === matrixKey
    );
    if (findIndex > 0) {
      const thisConditions: AttributeInfo[] = [];
      let currentIndex = findIndex - 1;
      while (
        currentIndex >= 0 &&
        conditions[currentIndex].attrName === 'elif'
      ) {
        thisConditions.unshift(conditions[currentIndex]);
        currentIndex--;
      }
      if (currentIndex >= 0 && conditions[currentIndex].attrName === 'if') {
        thisConditions.unshift(conditions[currentIndex]);
      }
      return thisConditions;
    }
    return [];
  }
}

export function directive(
  elem: ElementNode,
  dir: string,
  expOrFn: ExpOrFn,
  tag: string,
  options: DirectiveOptions
) {
  const directive = new Directive(elem, dir, expOrFn, tag, options);
  directive.parse();
  return directive.result;
}
