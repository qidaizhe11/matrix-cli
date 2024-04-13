import BaseModule from './BaseModule';

class ComponentModule extends BaseModule {
  constructor(options) {
    super(options);
    this.type = 'Component';
  }
}

export default ComponentModule;
