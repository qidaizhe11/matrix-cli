import postcssAdjustRemPlugin from "./postcssAdjustRemPlugin"
import postcssReplaceClassNamePlugin from "./postcssReplaceClassNamePlugin"

export const getPostcssPlugins = (componentName: string) => {
  return [
    postcssReplaceClassNamePlugin(componentName),
    postcssAdjustRemPlugin(),
  ]
}
