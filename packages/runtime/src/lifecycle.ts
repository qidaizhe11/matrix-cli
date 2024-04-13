interface LifecycleMap {
  [key: string]: string[];
}

export interface ComponentLifecycle<P, S, SS = any> {
  componentWillMount?(): void;
  componentDidMount?(): void;
  componentWillReceiveProps?(nextProps: Readonly<P>, nextContext: any): void;
  shouldComponentUpdate?(
    nextProps: Readonly<P>,
    nextState: Readonly<S>,
    nextContext: any
  ): boolean;
  componentWillUpdate?(
    nextProps: Readonly<P>,
    nextState: Readonly<S>,
    nextContext: any
  ): void;
  componentDidUpdate?(
    prevProps: Readonly<P>,
    prevState: Readonly<S>,
    snapshot?: SS
  ): void;
  componentWillUnmount?(): void;
  componentDidCatch?(err: string): void;
  componentDidShow?(): void;
  componentDidHide?(): void;
}

export enum LifeCycles {
  WillMount = 'componentWillMount',
  DidMount = 'componentDidMount',
  DidShow = 'componentDidShow',
  DidHide = 'componentDidHide',
  WillUnmount = 'componentWillUnmount'
}

export const lifecycleMap: LifecycleMap = {
  [LifeCycles.WillMount]: ['created'],
  [LifeCycles.DidMount]: ['attached'],
  [LifeCycles.DidShow]: ['onShow'],
  [LifeCycles.DidHide]: ['onHide'],
  [LifeCycles.WillUnmount]: ['detached', 'onUnload']
};

export const lifecycles = new Set<string>(['ready']);

for (const key in lifecycleMap) {
  const lifecycle = lifecycleMap[key];
  lifecycle.forEach((l) => lifecycles.add(l));
}

export const uniquePageLifecycle = [
  'onPullDownRefresh',
  'onReachBottom',
  'onShareAppMessage',
  'onShareTimeline',
  'onAddToFavorites',
  'onPageScroll',
  'onResize',
  'onTabItemTap'
];

export const appOptions = [
  'onLaunch',
  'onShow',
  'onHide',
  'onError',
  'onPageNotFound',
  'onUnhandledRejection',
  'onThemeChange'
];
