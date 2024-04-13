function camelcase(name) {
  return name
    .split('-')
    .map((item, i) =>
      i === 0 ? item : item.charAt(0).toUpperCase() + item.slice(1)
    )
    .join('');
}

function datasetProxy(target) {
  if (target && !target.datasetDefined) {
    const dataset = target.dataset || {};
    const keys = Object.keys(dataset);
    const newDataset = {};
    keys.forEach((key) => {
      const value = dataset[key];
      newDataset[key] = wmrt.parse(value);
    });
    Object.defineProperty(target, 'dataset', {
      get: function () {
        return newDataset;
      }
    });
    target.datasetDefined = true;
  }
}

const isPcPreview = false;

const wmrt = {
  rem: (value) => {
    if (!value) {
      return value;
    }
    if (/[\d.]+(px|rpx)/.test(value)) {
      return value.replace(/([\d.]+)(px|rpx)/g, (_, number, unit) => {
        if (isPcPreview) {
          number = unit === 'px' ? number : number / 2;
          return number + 'px';
        }

        number = unit === 'px' ? number * 2 : number;
        return (
          (number ? Math.floor((number / 7.5) * 1000000) / 1000000 : 0) + 'vw'
        );
      });
    }

    return value;
  },
  style: (style) => {
    if (!style) {
      return null;
    }

    const styleObj = style.split(';').reduce((obj, pair) => {
      let [k, v] = pair.split(':');
      if (!k) return obj;
      k = k.trim();
      v = v.trim();

      // style中 中划线转驼峰，-- 开头自定义变量不转换
      if (!k.startsWith('--') && /-/.test(k)) {
        k = camelcase(k);
      }

      obj[k] = wmrt.rem(v);
      return obj;
    }, {});
    return styleObj;
  },
  cn: (clsName, componentName) => {
    // clsName 可能是 number 0，提前处理
    if (typeof clsName === 'number') {
      clsName = '' + clsName;
    }

    if (!clsName) {
      return clsName;
    }

    if (typeof clsName !== 'string') {
      if (Array.isArray(clsName)) {
        // clsName 可能是数组！如 ['grid', 'line']
        clsName = clsName.join(' ');
      } else {
        // 其他非 string 类型 clsName，直接返回
        return clsName;
      }
    }
    const value = clsName
      .split(' ')
      .map((item) => {
        return item && item + '__' + componentName;
      })
      .filter((item) => item);
    return value.join(' ');
  },
  stringify: (value) => {
    if (value && typeof value === 'object') {
      return JSON.stringify(value);
    }

    return value;
  },
  parse: (value) => {
    try {
      const v = JSON.parse(value);
      return v;
    } catch (e) {
      console.log(e);
      return value;
    }
  },
  detail: (event) => {
    if (event.target) {
      event.detail = Object.assign({}, event.detail, event.target);
    }
  },
  dataset: (event) => {
    datasetProxy(event.target);
    datasetProxy(event.currentTarget);
  }
};

wmrt.event = (eventName, that) => {
  return (e) => {
    const event = {
      type: e.type,
      detail: e.detail,
      target: e.target,
      currentTarget: e.currentTarget
    };
    wmrt.detail(event);
    wmrt.dataset(event);
    if (that.props.__isTemplate) {
      that.props.callEvent(eventName, event);
    } else {
      that[eventName].call(that, event);
    }
  };
};

export { wmrt };
