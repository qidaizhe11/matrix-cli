import { logger } from '@matrix/utils';
import type { Compiler } from '../../compiler';
import { Plugin } from '../../plugin';

export default class LibraryGeneratorPlugin implements Plugin {
  name = 'LibraryGeneratorPlugin';

  apply(compiler: Compiler) {
    compiler.hooks.compilation.tap(this.name, (compilation) => {
      compilation.hooks.processAssets.tapPromise(
        this.name,
        async (compilation) => {
          try {
            const collections = compiler.context.collectionsMap;
            if (!(collections && collections.size > 0)) {
              return;
            }
            const collectionList = [...new Set(collections.values())];
            await Promise.all(
              collectionList.map(async (collection) => {
                const file = await compilation.fileResolver.resolveFile(
                  collection.filePath,
                  collection.fileType || ''
                );

                if (file.content) {
                  await compilation.dependencyCollector.processFile(
                    compilation,
                    file
                  );
                }
              })
            );
          } catch (err) {
            logger.error(
              `[${compilation.module.name}][${this.name}] ${err.message}`
            );
            throw err;
          }
        }
      );
    });
  }
}
