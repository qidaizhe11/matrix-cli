import { DIRECTIVES_PRIORITY } from './constants';

/**
 * 节点属性(attribute)优先级梳理
 * @param attributeKeys 原属性列表
 * @returns 按照优先级梳理后的属性列表
 */
export const attributePriorityRanking = (attributeKeys: string[]): string[] => {
  const keysCopy = attributeKeys.slice();
  const ranks: string[] = [];
  DIRECTIVES_PRIORITY.forEach((dirsOfDiffLevel) => {
    const intersections: string[] = dirsOfDiffLevel.filter((dir) => {
      const idx = keysCopy.indexOf(dir);
      if (idx > -1) {
        keysCopy.splice(idx, 1);
        return dir;
      }
    });
    intersections.length > 0 && ranks.push(...intersections);
  });
  keysCopy.length > 0 && ranks.push(...keysCopy);
  return ranks;
};
