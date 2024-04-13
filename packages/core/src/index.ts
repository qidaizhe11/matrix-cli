import type { Compiler } from './compiler';
import compiler, { CompilerOptions } from './compiler';

export default function core(options: CompilerOptions) {
  const app = compiler(options);
  app.run();

  return app;
}

export { CompilerOptions, Compiler };
