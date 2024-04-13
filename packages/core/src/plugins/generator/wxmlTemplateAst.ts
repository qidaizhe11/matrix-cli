import { parse } from '@babel/parser'

const jsxTemplate = `
import React from 'react'
import { wxmlTemplate } from '@matrix/runtime'

class TemplateComponent extends React.Component {
  render() {
    return <div>我是自定义组件</div>
  }
}

export default wxmlTemplate(TemplateComponent)
`

export default function createWxmlTemplateAst() {
  return parse(jsxTemplate, {
    sourceType: "module",
    plugins: [
      'jsx'
    ]
  })
}
