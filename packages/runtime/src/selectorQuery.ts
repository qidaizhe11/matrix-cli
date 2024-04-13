export type SelectorQueryFields = {
  id?: boolean;
  dataset?: boolean;
  mark?: boolean;
  rect?: boolean;
  size?: boolean;
  scrollOffset?: boolean;
  properties?: string[];
  // TODO: support computedStyle
};

export type SelectorQueryResult<T extends SelectorQueryFields> = {
  id: T['id'] extends true ? string : undefined;
  dataset: T['dataset'] extends true ? { [k: string]: any } : undefined;
  mark: T['mark'] extends true ? { [k: string]: any } : undefined;
  left: T['rect'] extends true ? number : undefined;
  top: T['rect'] extends true ? number : undefined;
  right: T['rect'] extends true ? number : undefined;
  bottom: T['rect'] extends true ? number : undefined;
  width: T['size'] extends true ? number : undefined;
  height: T['size'] extends true ? number : undefined;
  scrollLeft: T['scrollOffset'] extends true ? number : undefined;
  scrollTop: T['scrollOffset'] extends true ? number : undefined;
  scrollWidth: T['scrollOffset'] extends true ? number : undefined;
  scrollHeight: T['scrollOffset'] extends true ? number : undefined;
} & {
  [K in T['properties'] extends (infer I extends string)[] ? I : never]: any;
};

export type BoundingClientRect = {
  id: string;
  dataset: { [k: string]: any };
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type ScrollOffset = {
  id: string;
  dataset: { [k: string]: any };
  scrollLeft: number;
  scrollTop: number;
  scrollWidth: number;
  scrollHeight: number;
};

const joinAsync = <T>(
  inits: ((cb: (ret: T) => void) => void)[],
  cb: (rets: T[]) => void
) => {
  let initDone = false;
  let jobCount = inits.length;
  const rets = new Array<T>(jobCount);
  inits.forEach((init, index) => {
    init((ret) => {
      rets[index] = ret;
      jobCount -= 1;
      if (jobCount === 0 && initDone) {
        cb(rets);
      }
    });
  });
  initDone = true;
  if (jobCount === 0) {
    setTimeout(() => {
      cb(rets);
    }, 0);
  }
};

class NodesRef<S extends boolean> {
  private _$sq: SelectorQuery;
  private _$comp: any;
  private _$sel: string | null;
  private _$single: S;

  constructor(
    selectorQuery: SelectorQuery,
    component: any,
    selector: string | null,
    selectSingle: S
  ) {
    this._$sq = selectorQuery;
    this._$comp = component;
    this._$sel = selector;
    this._$single = selectSingle;
  }

  fields<T extends SelectorQueryFields>(
    fields: T,
    cb: (
      res: S extends true ? SelectorQueryResult<T> : SelectorQueryResult<T>[]
    ) => void = () => {
      /* empty */
    }
  ) {
    this._$sq._$push(this._$sel, this._$comp, this._$single, fields, cb);
    return this._$sq;
  }

  boundingClientRect(
    cb: (
      res: S extends true ? BoundingClientRect : BoundingClientRect[]
    ) => void = () => {
      /* empty */
    }
  ) {
    this._$sq._$push(
      this._$sel,
      this._$comp,
      this._$single,
      {
        id: true,
        dataset: true,
        rect: true,
        size: true
      },
      cb
    );
    return this._$sq;
  }

  scrollOffset(
    cb: (res: S extends true ? ScrollOffset : ScrollOffset[]) => void = () => {
      /* empty */
    }
  ) {
    this._$sq._$push(
      this._$sel,
      this._$comp,
      this._$single,
      {
        id: true,
        dataset: true,
        scrollOffset: true
      },
      cb
    );
    return this._$sq;
  }
}

// main class
export class SelectorQuery {
  private _$comp: any;
  /** @internal */
  _$queue: {
    component: any;
    selector: string | null;
    single: boolean;
    fields: SelectorQueryFields;
    cb: (res: any) => void;
  }[];

  /** @internal */
  constructor(component: any) {
    this._$comp = component;
    this._$queue = [];
  }

  /** Change where the node should be selected from */
  in(component: any) {
    this._$comp = component;
    return this;
  }

  /** Select the first node that matches the selector */
  select(selector: string) {
    return new NodesRef(this, this._$comp, selector, true);
  }

  /** Select all nodes that match the selector */
  selectAll(selector: string) {
    return new NodesRef(this, this._$comp, selector, false);
  }

  /**
   * Select the viewport of the component
   *
   * Only the size and the scroll position is meaningful when the viewport is selected.
   */
  selectViewport() {
    return new NodesRef(this, this._$comp, null, true);
  }

  /** @internal */
  _$push(
    selector: string | null,
    component: any,
    single: boolean,
    fields: SelectorQueryFields,
    cb: (res: any) => void
  ) {
    this._$queue.push({
      component,
      selector,
      single,
      fields,
      cb
    });
  }

  /**
   * Execute all queries
   *
   * The `cb` is called after all queries done.
   */
  exec(
    cb: (resList: any[]) => void = () => {
      /* empty */
    }
  ) {
    const q = this._$queue;
    joinAsync<any>(
      q.map((req) => (done) => {
        const { component, selector, single, fields, cb } = req;
        if (selector === null) {
          // for the viewport selection, return available fields
          const res = {} as { [k: string]: any };
          joinAsync<undefined>(
            [
              (done) => {
                const ctx = document.body;
                const width = ctx.clientWidth;
                const height = ctx.clientHeight;
                if (fields.id) res.id = '';
                if (fields.dataset) res.dataset = {};
                if (fields.mark) res.mark = {};
                if (fields.rect) {
                  res.left = 0;
                  res.top = 0;
                  res.right = width;
                  res.bottom = height;
                }
                if (fields.size) {
                  res.width = width;
                  res.height = height;
                }
                if (fields.scrollOffset) {
                  const { left, top, width, height } =
                    ctx.getBoundingClientRect();
                  res.scrollLeft = left;
                  res.scrollTop = top;
                  res.scrollWidth = width;
                  res.scrollHeight = height;
                  done(undefined);
                } else {
                  done(undefined);
                }
              }
            ],
            () => {
              cb(res);
              done(res);
            }
          );
        } else {
          let container =
            component && component.$matrixRef
              ? component.$matrixRef.current
              : document;
          if (!container) {
            container = document;
          }
          // for common node selection, return specified fields
          const constructSingleRes = (
            elem: HTMLElement,
            cb: (res: any) => void
          ) => {
            const res = {} as { [k: string]: any };
            if (fields.id) res.id = elem.id;
            if (fields.dataset) res.dataset = Object.assign({}, elem.dataset);
            joinAsync<undefined>(
              [
                (done) => {
                  if (fields.rect || fields.size) {
                    const rect = elem.getBoundingClientRect();
                    if (fields.rect) {
                      res.left = rect.left;
                      res.top = rect.top;
                      res.right = rect.left + rect.width;
                      res.bottom = rect.top + rect.height;
                    }
                    if (fields.size) {
                      res.width = rect.width;
                      res.height = rect.height;
                    }
                    done(undefined);
                  } else {
                    done(undefined);
                  }
                },
                (done) => {
                  if (fields.scrollOffset) {
                    res.scrollLeft = elem.scrollLeft;
                    res.scrollTop = elem.scrollTop;
                    res.scrollWidth = elem.scrollWidth;
                    res.scrollHeight = elem.scrollHeight;
                    done(undefined);
                  } else {
                    done(undefined);
                  }
                }
              ],
              () => {
                if (fields.properties) {
                  fields.properties.forEach((propName) => {
                    const attr = elem.getAttribute(propName);
                    if (attr) {
                      res[propName] = attr;
                    }
                  });
                }
                cb(res);
              }
            );
          };
          if (single) {
            // select single node
            const node = container.querySelector(selector) as HTMLElement;
            if (node) {
              constructSingleRes(node, (res) => {
                cb(res);
                done(res);
              });
            } else {
              setTimeout(() => {
                cb(null);
                done(null);
              }, 0);
            }
          } else {
            // select multiple nodes
            const nodes = container.querySelectorAll(selector);
            const asyncInits: any[] = [];
            nodes.forEach((node: HTMLElement) => {
              asyncInits.push((done) => {
                constructSingleRes(node, (res) => {
                  done(res);
                });
              });
            });
            joinAsync<any>(asyncInits, (resList) => {
              cb(resList);
              done(resList);
            });
          }
        }
      }),
      cb
    );
  }
}
