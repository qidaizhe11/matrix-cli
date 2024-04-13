import { getPath, logger, maybeNpmPath, strike2camelCase } from '@matrix/utils';
import conditionalCompilation from '../conditional-compilation';
import fse from 'fs-extra';
import { glob } from 'glob';
import path, { isAbsolute } from 'path';

import type { Compiler } from '../../compiler';
import BaseModule from '../../modules/BaseModule';
import { Plugin } from '../../plugin';

interface ModuleBasic {
  name: string;
  entry: string;
  absPath: string;
}

export default class ComponentCompilerEntryPlugin implements Plugin {
  name = 'ComponentCompilerEntryPlugin';

  compiler: Compiler;

  flattedModulesMap: Map<string, BaseModule>;

  apply(compiler: Compiler) {
    compiler.hooks.entryDependency.tap(this.name, (compiler) => {
      this.compiler = compiler;
      this.init();
      this.genModulesGraph();
      this.compiler.context.flattedModulesMap = this.flattedModulesMap;

      const result: any = [];
      this.flattedModulesMap.forEach((v, k) => {
        result.push(v.name);
      });
      logger.success(`[${this.name} flattedModulesMap] ${result.join(', ')}`);
    });
  }

  init() {
    this.flattedModulesMap = new Map();
  }

  // 生成模块树结构
  genModulesGraph() {
    const { options } = this.compiler;
    const { entry, root } = options;

    // 批量处理某个路径下的Page/Component

    const matches: ModuleBasic[] = glob
      .sync(`${entry}/**/*.wxml`, { cwd: root, posix: true, dotRelative: true })
      .map((item) => {
        const segments = item ? item.split('/') : item;
        if (!segments) {
          logger.warn(
            `[${this.name}] entry: '${entry}' got empty, make sure 'entry' field is correct.`
          );
          return;
        }

        const name = segments[segments.length - 2];
        const componenName = strike2camelCase(name);

        const moduleItem: ModuleBasic = {
          name: componenName,
          entry: path.resolve(root, entry),
          absPath: path.resolve(root, item)
        };
        return moduleItem;
      })
      .filter((item): item is ModuleBasic => !!item);

    if (!matches || matches.length === 0) {
      logger.warn(
        `[${this.name}] entry: '${entry}' got empty, make sure 'entry' field is correct.`
      );
      return;
    }
    logger.success(
      `[${this.name}] entry '${entry}' got: ${matches
        .map((item) => item.absPath)
        .join('\n')}`
    );
    matches.forEach((module) => this.genModuleSync(module));
  }

  /**
   * 遍历每个Page/Component 同步生成模块（Page或者Component）
   */
  genModuleSync(module: ModuleBasic) {
    const { absPath, name } = module;

    // 已经处理过，就不再处理
    if (this.flattedModulesMap.has(absPath)) {
      logger.warn(
        `[${this.name}] '${name}' already included in flattedModulesMap.`
      );
      return;
    }

    // json 文件解析
    const configPath = getPath(absPath, '.json');
    if (!fse.existsSync(configPath)) {
      logger.error(`[${this.name}] '${module.name}' not exists: ${configPath}`);
      return;
    }
    const jsonConfig = this.getJsonConfig(configPath);
    logger[jsonConfig.error ? 'warn' : 'success'](
      `[${this.name}] '${name}'\\'s usingComponents is ${JSON.stringify(
        jsonConfig.usingComponents
      )}`
    );

    // js 文件解析
    let jsPath = getPath(absPath, '.js');
    if (!fse.existsSync(jsPath)) {
      jsPath = getPath(absPath, '.ts');
    }

    // wxs 文件解析
    const wxsPathList = this.getWxsPathList(absPath);

    const generatedModule: BaseModule = new BaseModule({
      ...module,
      type: jsonConfig.component ? 'Component' : 'Page',
      jsonPath: configPath,
      jsonConfig: jsonConfig,
      jsPath,
      wxssPath: getPath(absPath, '.wxss'),
      wxsPathList: wxsPathList
    });

    this.flattedModulesMap.set(absPath, generatedModule);

    // 收集 usingComponents
    this.genDepComponents(
      generatedModule,
      generatedModule.jsonConfig.usingComponents
    );

    return generatedModule;
  }

  getJsonConfig(jsonPath: string) {
    let json = {
      component: true,
      usingComponents: {},
      error: false
    };
    try {
      let content = fse.readFileSync(jsonPath, 'utf-8');
      content = conditionalCompilation(content, {
        commentType: 'line',
        conditions: this.compiler.conditionDefinitions
      });
      json = JSON.parse(content);
    } catch (err) {
      json.error = true;
      logger.error(`[${this.name}] ${err.message}`);
      logger.warn(
        `[${this.name}] even though there is error, but still treat it as a component by default.`
      );
    }
    return json;
  }

  getWxsPathList(wxmlAbsPath: string): string[] {
    const basePath = path.dirname(wxmlAbsPath);
    const wxsPaths = glob.sync('*.wxs', { cwd: basePath });
    if (wxsPaths && wxsPaths.length > 0)
      return wxsPaths.map((p) => path.resolve(basePath, p));
    return [];
  }

  genDepComponents(
    module: BaseModule,
    usingComponents: Record<string, string>
  ) {
    // console.log('genDepComponents, module:', module);
    const { type, name, absPath } = module;
    const parentModule = this.flattedModulesMap.get(absPath);

    const includeComponentsMap = new Map();
    if (!usingComponents || Object.keys(usingComponents).length === 0) {
      logger.info(`[${this.name}] ${type} '${name}' has empty dep-component.`);
      module.includeComponentsMap = includeComponentsMap;
      return;
    }

    Object.keys(usingComponents).forEach((tagName) => {
      const compPath = usingComponents[tagName];

      if (maybeNpmPath(compPath)) {
        // npm 解析过程定制性较强，单独插件处理
        return;
      }

      let depAbsPath;
      if (isAbsolute(compPath)) {
        depAbsPath = compPath + '.wxml';
        if (!fse.existsSync(depAbsPath)) {
          depAbsPath = path.resolve(compPath, 'index.wxml');
        }
      } else {
        depAbsPath = path.resolve(absPath, '..', compPath + '.wxml');
        if (!fse.existsSync(depAbsPath)) {
          depAbsPath = path.resolve(absPath, '..', compPath, 'index.wxml');
        }
      }
      if (!fse.existsSync(depAbsPath)) {
        logger.error(
          `[${this.name}] usingComponents->${tagName}: ${compPath} not exists: ${depAbsPath}`
        );
        return;
      }

      const existModule = this.flattedModulesMap.get(depAbsPath);
      if (existModule) {
        if (parentModule) {
          existModule.issuer.push(parentModule);
        }
      } else {
        const depModuleBasic: ModuleBasic = {
          absPath: depAbsPath,
          name: strike2camelCase(tagName),
          entry: module.entry
        };
        const depModule = this.genModuleSync(depModuleBasic);
        if (depModule) {
          this.flattedModulesMap.set(depModule.absPath, depModule);
          includeComponentsMap.set(depModule.name, {
            from: compPath,
            defaultExport: true
          });
        }
      }
    });

    module.includeComponentsMap = includeComponentsMap;

    const result: any = [];
    module.includeComponentsMap.forEach((value, key) => {
      result.push(key);
    });
    logger.success(
      `[${this.name}] ${type} '${name}' includeComponentsMap=${
        result.join(',') || '{}'
      }.`
    );
  }
}
