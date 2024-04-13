import React from 'react';
import { Behavior } from './behavior';
import { clone } from './clone';
import { diff } from './diff';
import { LocalIntersectionObserver } from './intersectionObserver';
import {
  ComponentLifecycle,
  LifeCycles,
  lifecycleMap,
  lifecycles
} from './lifecycle';
import _$_ from './runtime';
import { SelectorQuery } from './selectorQuery';
import {
  bind,
  flattenBehaviors,
  isEqual,
  nonsupport,
  report,
  safeGet,
  safeSet
} from './utils';
import { wmrt } from './wmrt';
import { wxmlTemplate } from './wxmlTemplate';
import * as wxsRuntime from './wxs';

type Func = (...args: any[]) => any;
type Observer = (newProps: any, oldProps: any, changePath: string) => void;

interface ObserverProperties {
  name: string;
  observer: string | Observer;
}

interface ComponentClass<P = Record<string, any>, S = Record<string, any>>
  extends ComponentLifecycle<P, S> {
  new (props: P);
  externalClasses: Record<string, unknown>;
  defaultProps?: Partial<P>;
  _observeProps?: ObserverProperties[];
  observers?: Record<string, Func>;
}

interface WxOptions {
  methods?: Record<string, Func>;
  properties?: Record<string, Record<string, unknown> | Func>;
  props?: Record<string, unknown>;
  data?: Record<string, unknown>;
  observers?: Record<string, Func>;
  lifetimes?: Record<string, Func>;
  behaviors?: any[];
  $designHOC?: any;
  $designObserver?: any;
}

function defineProxy(component: any, key: string, getter: string) {
  const initData =
    getter === 'props'
      ? { ...component.filteredProps }
      : {
          ...component.state,
          ...component.filteredProps
        };
  component[key] = new Proxy(initData, {
    get: (object, prop) => {
      const realObject =
        getter === 'props'
          ? component.filteredProps
          : {
              ...component.state,
              ...component.filteredProps
            };
      return Reflect.get(realObject, prop);
    },
    set:
      getter === 'props'
        ? undefined
        : (object, prop, value) => {
            component.state[prop] = value;
            return true;
          }
  });
}

function isFunction(o: any): o is Func {
  return typeof o === 'function';
}

export default function withWeapp(weappConf: WxOptions) {
  if (typeof weappConf === 'object' && Object.keys(weappConf).length === 0) {
    report(
      'withWeapp 请传入“组件”的配置对象。如果原生写法使用了基类，请将基类组合后的配置对象传入，详情请参考文档。'
    );
  }
  return (ConnectComponent: ComponentClass<any, any>) => {
    const behaviorMap = new Map<string, any[]>([
      ['properties', []],
      ['data', []],
      ['methods', []],
      ['created', []],
      ['attached', []],
      ['ready', []],
      ['detached', []]
    ]);
    const behaviorProperties: any = {};
    if (weappConf.behaviors?.length) {
      const { behaviors } = weappConf;
      behaviors.forEach((behavior) => flattenBehaviors(behavior, behaviorMap));

      const propertiesList = behaviorMap.get('properties')!;
      if (propertiesList.length) {
        propertiesList.forEach((property) => {
          Object.assign(behaviorProperties, property);
        });
        Object.keys(behaviorProperties).forEach((propName) => {
          const propValue = behaviorProperties[propName];
          if (!weappConf.properties) {
            weappConf.properties = {};
          }
          if (!weappConf.properties.hasOwnProperty(propName)) {
            if (propValue && typeof propValue === 'object' && propValue.value) {
              propValue.value = clone(propValue.value);
            }
            weappConf.properties[propName] = propValue;
          }
        });
      }
    }

    class BaseComponent<
      P = Record<string, any>,
      S = Record<string, any>
    > extends ConnectComponent {
      private _observeProps: ObserverProperties[] = [];

      // mixins 可以多次调用生命周期
      private willMounts: Func[] = [];

      private didMounts: Func[] = [];

      private didHides: Func[] = [];

      private didShows: Func[] = [];

      private willUnmounts: Func[] = [];

      private readyLifecycles: Func[] = [];

      private eventDestroyList: Func[] = [];

      public observers?: Record<string, Func>;

      public taroGlobalData: Record<any, any> = Object.create(null);

      public data: any;

      private state: any = {
        styleInjections: []
      };

      private $matrixRef = React.createRef();

      private filteredProps: Record<string, any> = {};

      constructor(props: any) {
        super(props);
        this.state = this.state || {};
        this.filteredProps = {};
        this.init(weappConf);
        defineProxy(this, 'data', 'state');
        defineProxy(this, 'properties', 'props');
      }

      private initProps(props: any) {
        for (const propKey in props) {
          if (props.hasOwnProperty(propKey)) {
            const propValue = props[propKey];
            // propValue 可能是 null, 构造函数, 对象
            if (propValue && !isFunction(propValue)) {
              if (propValue.observer) {
                this._observeProps.push({
                  name: propKey,
                  observer: propValue.observer
                });

                if (weappConf.$designObserver && propKey === 'store') {
                  const disposer = weappConf.$designObserver(() => {
                    const observer = propValue.observer;
                    if (typeof observer === 'string') {
                      const ob = this[observer];
                      if (isFunction(ob)) {
                        ob.call(this, this.props.store);
                      }
                    } else if (isFunction(observer)) {
                      observer.call(this, this.props.store);
                    }
                  });
                  this.eventDestroyList.push(disposer);
                }
              }
            }
          }
        }
      }

      private init(options: WxOptions) {
        // 处理 Behaviors
        if (options.behaviors?.length) {
          for (const [key, list] of behaviorMap.entries()) {
            switch (key) {
              case 'created':
              case 'attached':
              case 'detached':
              case 'ready':
                list.forEach((fn) => this.initLifeCycles(key, fn));
                break;
            }
          }
        }

        for (const confKey in options) {
          // 不支持的属性
          if (nonsupport.has(confKey)) {
            const advise = nonsupport.get(confKey);
            report(advise);
          }

          const confValue = options[confKey];

          switch (confKey) {
            case 'behaviors':
              break;
            case 'data': {
              this.state = {
                ...confValue,
                ...this.state
              };
              break;
            }
            case 'properties':
              this.initProps(Object.assign(behaviorProperties, confValue));
              break;
            case 'methods':
              for (const key in confValue) {
                const method = confValue[key];
                this[key] = bind(method, this);
              }
              break;
            case 'lifetimes':
              for (const key in confValue) {
                this.initLifeCycles(key, confValue[key]);
              }
              break;
            case 'pageLifetimes':
              for (const key in confValue) {
                switch (key) {
                  case 'show': {
                    report('不支持组件所在页面的生命周期 pageLifetimes.show');
                    break;
                  }
                  case 'hide': {
                    report('不支持组件所在页面的生命周期 pageLifetimes.hide');
                    break;
                  }
                  case 'resize': {
                    report(
                      '不支持组件所在页面的生命周期 pageLifetimes.resize。'
                    );
                    break;
                  }
                }
              }
              break;
            case 'observers':
              this.initObservers(confValue);
              break;
            default:
              if (lifecycles.has(confKey)) {
                // 优先使用 lifetimes 中定义的生命周期
                if (options.lifetimes?.[confKey]) {
                  break;
                }

                const lifecycle = options[confKey];
                this.initLifeCycles(confKey, lifecycle);
              } else if (isFunction(confValue)) {
                this[confKey] = bind(confValue, this);
              } else {
                this[confKey] = confValue;
              }

              break;
          }
        }

        // 处理 Behaviors
        if (options.behaviors?.length) {
          const behaviorData: any = {};
          const methods: any = {};
          for (const [key, list] of behaviorMap.entries()) {
            switch (key) {
              case 'data':
                [...list, this.state].forEach((dataObject, index) => {
                  Object.keys(dataObject).forEach((dataKey) => {
                    const value = dataObject[dataKey];
                    const preValue = behaviorData[dataKey];
                    const valueType = typeof value;
                    const preValueType = typeof preValue;
                    if (valueType === 'object') {
                      if (!value) {
                        behaviorData[dataKey] = value;
                      } else if (
                        preValueType !== 'object' ||
                        !preValueType ||
                        Array.isArray(value)
                      ) {
                        behaviorData[dataKey] =
                          index === list.length ? value : clone(value);
                      } else {
                        const newVal = Object.assign({}, preValue, value);
                        behaviorData[dataKey] =
                          index === list.length ? newVal : clone(newVal);
                      }
                    } else {
                      behaviorData[dataKey] = value;
                    }
                  });
                });
                this.state = behaviorData;
                break;
              case 'methods':
                list.forEach((methodsObject) => {
                  Object.assign(methods, methodsObject);
                });
                Object.keys(methods).forEach((methodName) => {
                  if (!this[methodName]) {
                    const method = methods[methodName];
                    this[methodName] = bind(method, this);
                  }
                });
                break;
              default:
                break;
            }
          }
        }

        this.filteredProps = this.getFilteredProps(this.props);
      }

      private initLifeCycles(lifecycleName: string, lifecycle: Func) {
        // 不支持的生命周期
        if (nonsupport.has(lifecycleName)) {
          const advise = nonsupport.get(lifecycleName);
          return report(advise);
        }

        if (lifecycleName === 'ready') {
          this.readyLifecycles.push(lifecycle);
        } else {
          for (const lifecycleKey in lifecycleMap) {
            const cycleNames = lifecycleMap[lifecycleKey];
            if (cycleNames.indexOf(lifecycleName) !== -1) {
              switch (lifecycleKey) {
                case LifeCycles.DidHide:
                  this.didHides.push(lifecycle);
                  break;
                case LifeCycles.DidMount:
                  this.didMounts.push(lifecycle);
                  break;
                case LifeCycles.DidShow:
                  this.didShows.push(lifecycle);
                  break;
                case LifeCycles.WillMount:
                  this.willMounts.push(lifecycle);
                  break;
                case LifeCycles.WillUnmount:
                  this.willUnmounts.push(lifecycle);
                  break;
                default:
                  break;
              }
            }
          }
        }

        // mixins 不会覆盖已经设置的生命周期，加入到 this 是为了形如 this.created() 的调用
        if (!isFunction(this[lifecycleName])) {
          this[lifecycleName] = lifecycle;
        }
      }

      private initObservers(observers: any) {
        if (observers == null) {
          return;
        }
        if (Object.keys(observers).length === 0) {
          return;
        }
        if (!weappConf.$designObserver) {
          return;
        }

        for (const observerKey in observers) {
          if (/\*\*/.test(observerKey) || observerKey.includes(',')) {
            continue;
          }

          if (observerKey === 'store' || observerKey.startsWith('store.')) {
            const disposer = weappConf.$designObserver(() => {
              const observer = observers[observerKey];
              observer.call(this, safeGet(this.props, observerKey));
            });
            this.eventDestroyList.push(disposer);
          }
        }
      }

      private getFilteredProps(props: any) {
        const filteredProps: any = {};
        const weappConfProps = weappConf.properties;
        for (const key in props) {
          const isValidKey =
            (weappConfProps && weappConfProps.hasOwnProperty(key)) ||
            key === 'wmrt' ||
            key === 'id' ||
            key.startsWith('data-') ||
            (key.startsWith('on') && isFunction(props[key]));
          if (isValidKey) {
            filteredProps[key] = props[key];
          }
        }
        return filteredProps;
      }

      private safeExecute = (func?: Func, ...args: unknown[]) => {
        if (isFunction(func)) func.apply(this, args);
      };

      private executeLifeCycles(funcs: Func[], ...args: unknown[]) {
        for (let i = 0; i < funcs.length; i++) {
          const func = funcs[i];
          this.safeExecute(func, ...args);
        }
      }

      private triggerPropertiesObservers(prevProps: any, nextProps: any) {
        this._observeProps.forEach(({ name: key, observer }) => {
          const prop = prevProps?.[key];
          const nextProp = nextProps[key];
          // 小程序是深比较不同之后才 trigger observer
          if (!isEqual(prop, nextProp)) {
            if (typeof observer === 'string') {
              const ob = this[observer];
              if (isFunction(ob)) {
                ob.call(this, nextProp, prop, key);
              }
            } else if (isFunction(observer)) {
              observer.call(this, nextProp, prop, key);
            }
          }
        });
      }

      private triggerObservers(current: any, prev: any) {
        const observers = this.observers;
        if (observers == null) {
          return;
        }

        if (Object.keys(observers).length === 0) {
          return;
        }

        const result = diff(current, prev);
        const resultKeys = Object.keys(result);
        if (resultKeys.length === 0) {
          return;
        }

        for (const observerKey in observers) {
          if (/\*\*/.test(observerKey)) {
            report('数据监听器 observers 不支持使用通配符 **。');
            continue;
          }

          const keys = observerKey.split(',').map((k) => k.trim());
          let isModified = false;

          for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            for (let j = 0; j < resultKeys.length; j++) {
              const resultKey = resultKeys[j];
              if (
                resultKey.startsWith(key) ||
                (key.startsWith(resultKey) && key.endsWith(']'))
              ) {
                isModified = true;
              }
            }
          }
          if (isModified) {
            observers[observerKey].apply(
              this,
              keys.map((key) => safeGet(current, key))
            );
          }
        }
      }

      public privateStopNoop(...args) {
        let e;
        let fn;
        if (args.length === 2) {
          fn = args[0];
          e = args[1];
        } else if (args.length === 1) {
          e = args[0];
        }
        if (e.type === 'touchmove') {
          report(
            'catchtouchmove 转换后只能停止回调函数的冒泡，不能阻止滚动穿透。如要阻止滚动穿透，可以手动给编译后的 View 组件加上 catchMove 属性'
          );
        }
        e.stopPropagation();
        isFunction(fn) && fn(e);
      }

      // ================ React 生命周期 ================

      public componentWillMount() {
        this.safeExecute(super.componentWillMount);
        this.executeLifeCycles(this.willMounts);
        this.filteredProps = this.getFilteredProps(this.props);
        this.triggerObservers(this.data, BaseComponent.defaultProps);
        this.triggerPropertiesObservers(
          BaseComponent.defaultProps,
          this.filteredProps
        );
      }

      public componentDidMount() {
        this.safeExecute(super.componentDidMount);
        this.executeLifeCycles(this.didMounts);
        this.executeLifeCycles(this.readyLifecycles);
      }

      public componentWillUnmount() {
        this.eventDestroyList.forEach((fn) => fn());
        this.safeExecute(super.componentWillUnmount);
        this.executeLifeCycles(this.willUnmounts);
      }

      public componentDidHide() {
        this.safeExecute(super.componentDidHide);
        this.executeLifeCycles(this.didHides);
      }

      public componentDidShow() {
        this.safeExecute(super.componentDidShow);
        this.executeLifeCycles(this.didShows);
      }

      public componentDidUpdate(prevProps: P, prevState: S) {
        this.filteredProps = this.getFilteredProps(this.props);
        const filteredPrevProps = this.getFilteredProps(prevProps);
        this.triggerObservers(this.filteredProps, filteredPrevProps);
        this.triggerPropertiesObservers(filteredPrevProps, this.filteredProps);
        this.safeExecute(super.componentDidUpdate);
      }

      // ================ 小程序 App, Page, Component 实例属性与方法 ================

      public setData = (obj: S, callback?: () => void) => {
        let oldState: any;
        if (this.observers && Object.keys(Object.keys(this.observers))) {
          oldState = clone(this.state);
        }
        Object.keys(obj as any).forEach((key) => {
          safeSet(this.state, key, obj[key]);
        });
        this.setState(this.state, () => {
          this.triggerObservers(this.state, oldState);
          if (callback) {
            callback.call(this);
          }
        });
      };

      public triggerEvent = (eventName: string, detail, options) => {
        if (options) {
          report('triggerEvent 不支持事件选项。');
        }

        // eventName support kebab case
        if (eventName.match(/[a-z]+-[a-z]+/g)) {
          eventName = eventName.replace(/-[a-z]/g, function (match) {
            return match[1].toUpperCase();
          });
        }

        const props = this.filteredProps;
        const dataset: any = {};
        for (const key in props) {
          if (!key.startsWith('data-')) continue;
          dataset[key.replace(/^data-/, '')] = props[key];
        }

        const func =
          props[`on${eventName[0].toUpperCase()}${eventName.slice(1)}`];
        if (isFunction(func)) {
          func.call(this, {
            type: eventName,
            detail,
            target: {
              id: props.id || '',
              dataset
            },
            currentTarget: {
              id: props.id || '',
              dataset
            }
          });
        }
      };

      public createSelectorQuery() {
        return new SelectorQuery(this);
      }

      public createIntersectionObserver(options) {
        return new LocalIntersectionObserver(this, options);
      }

      public selectComponent() {
        report(nonsupport.get('selectComponent'));
      }

      public selectAllComponents() {
        report(nonsupport.get('selectAllComponents'));
      }

      public selectOwnerComponent() {
        report(nonsupport.get('selectOwnerComponent'));
      }

      public groupSetData() {
        report(nonsupport.get('groupSetData'));
      }

      public callEvent = (eventName: string, event: any) => {
        if (this[eventName]) {
          this.safeExecute(this[eventName], event);
        }
      };
    }

    const props = weappConf.properties;

    if (props) {
      for (const propKey in props) {
        const propValue = props[propKey];
        if (propValue != null && !isFunction(propValue)) {
          if (propValue.value !== undefined) {
            // 如果是 null 也赋值到 defaultProps
            BaseComponent.defaultProps = {
              [propKey]: propValue.value,
              ...BaseComponent.defaultProps
            };
          }
        }
      }
    }

    const staticOptions = ['externalClasses', 'relations', 'options'];

    staticOptions.forEach((option) => {
      const value = weappConf[option];
      if (value != null) {
        BaseComponent[option] = value;
      }
    });

    BaseComponent.defaultProps = {
      wmrt: wmrt,
      ...BaseComponent.defaultProps
    };

    if (weappConf.$designHOC) {
      return weappConf.$designHOC(BaseComponent);
    }
    return BaseComponent;
  };
}

export { Behavior, _$_, wxmlTemplate, wxsRuntime };
