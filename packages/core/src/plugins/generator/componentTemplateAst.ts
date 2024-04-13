import { parse } from '@babel/parser'

const jsxTemplate = `
import React from 'react'
import withWeapp from '@matrix/runtime'

const withWeappOptions = {}

class TemplateComponent extends React.Component {
  componentDidMount() {}

  render() {
    return <div>我是自定义组件</div>
  }
}

export default withWeapp(withWeappOptions)(TemplateComponent)
`

export default function createComponentTemplateAst() {
  return parse(jsxTemplate, {
    sourceType: "module",
    plugins: [
      'jsx'
    ]
  })
}
