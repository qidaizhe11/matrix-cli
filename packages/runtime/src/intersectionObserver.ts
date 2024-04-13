type Listener = {
  element: Element;
  callback: () => void;
};

export type IntersectionObserverMargins = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export interface IntersectionObserverOptions {
  thresholds?: any;
  initialRatio?: number;
  selectAll?: boolean;
  dataset?: boolean;
}

export class LocalIntersectionObserver {
  // 自定义组件实例
  private _component: any;
  // 选项
  private _options = {
    thresholds: [0],
    initialRatio: 0,
    observeAll: false
  };

  // Observer实例
  private _observerInst: IntersectionObserver | undefined;
  // 监控中的选择器
  private _listeners: Listener[] = [];
  // 参照区域
  private _root: Element | null;
  // 用来扩展（或收缩）参照节点布局区域的边界
  private _rootMargin: IntersectionObserverMargins = {
    left: 0,
    top: 0,
    right: 0,
    bottom: 0
  };
  // 是否已初始化
  private _isInited = false;

  // selector 的容器节点
  protected get container() {
    const component = this._component;
    let container =
      component && component.$matrixRef
        ? component.$matrixRef.current
        : document;
    if (!container) {
      container = document;
    }
    return container;
  }

  constructor(component: any, options: IntersectionObserverOptions = {}) {
    this._component = component;
    Object.assign(this._options, options);
  }

  private createInst() {
    if (!window.IntersectionObserver) {
      console.error('IntersectionObserver not supported!');
      return;
    }
    // 去除原本的实例
    this.disconnect();

    const { left = 0, top = 0, bottom = 0, right = 0 } = this._rootMargin;
    return new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const _callback = this._getCallbackByElement(entry.target);
          const result = {
            boundingClientRect: entry.boundingClientRect,
            intersectionRatio: entry.intersectionRatio,
            intersectionRect: entry.intersectionRect,
            relativeRect: entry.rootBounds || {
              left: 0,
              right: 0,
              top: 0,
              bottom: 0
            },
            time: entry.time
          };
          // web端会默认首次触发
          // 如果首次检测到相交但比例不满足条件则退出
          if (
            !this._isInited &&
            !(
              this._options.initialRatio < entry.intersectionRatio &&
              this._options.thresholds[0] <= entry.intersectionRatio
            ) &&
            !(
              entry.intersectionRatio < this._options.initialRatio &&
              entry.intersectionRatio <=
                this._options.thresholds[this._options.thresholds.length - 1]
            )
          ) {
            return;
          }
          _callback && _callback.call(this, result);
        });
        this._isInited = true;
      },
      {
        root: this._root,
        rootMargin: [`${top}px`, `${right}px`, `${bottom}px`, `${left}px`].join(
          ' '
        ),
        threshold: this._options.thresholds
      }
    );
  }

  public disconnect(): void {
    if (this._observerInst) {
      let listener;
      while ((listener = this._listeners.pop())) {
        this._observerInst.unobserve(listener.element);
      }
      this._observerInst.disconnect();
    }
  }

  public observe(targetSelector: string, callback: () => void): void {
    // 同wx小程序效果一致，每个实例监听一个Selector
    if (this._listeners.length) return;
    // 监听前没有设置关联的节点
    if (!this._observerInst) {
      console.warn(
        'Intersection observer will be ignored because no relative nodes are found.'
      );
      return;
    }

    const nodeList = this._options.observeAll
      ? this.container.querySelectorAll(targetSelector)
      : [this.container.querySelector(targetSelector)];

    const observerInst = this._observerInst;
    setTimeout(() => {
      nodeList.forEach((element) => {
        if (!element) return;
        observerInst.observe(element);
        this._listeners.push({ element, callback });
      });
    }, 1);
  }

  public relativeTo(
    selector: string,
    margins?: IntersectionObserverMargins | undefined
  ): LocalIntersectionObserver {
    // 已设置observe监听后，重新关联节点
    if (this._listeners.length) {
      console.error(
        'Relative nodes cannot be added after "observe" call in IntersectionObserver'
      );
      return this;
    }
    this._root =
      (selector ? this.container.querySelector(selector) : document) || null;
    if (margins) {
      this._rootMargin = margins;
    }
    this._observerInst = this.createInst();
    return this;
  }

  public relativeToViewport(
    margins?: IntersectionObserverMargins | undefined
  ): LocalIntersectionObserver {
    return this.relativeTo('', margins);
  }

  private _getCallbackByElement(element: Element) {
    const listener = this._listeners.find(
      (listener) => listener.element === element
    );
    return listener ? listener.callback : null;
  }
}
