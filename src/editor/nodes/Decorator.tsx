import React from 'react'
import {Strong, Em, Code} from './index'

type Props = {
  attributes: {}
  mark: string
  children: React.ReactNode
}
export default function DecoratorComponent(props: Props) {
  switch(props.mark) {
    case 'strong':
      return (
      <Strong {...props.attributes}>{props.children}</Strong>
      )
    case 'em':
      return (
      <Em {...props.attributes}>{props.children}</Em>
      )
    case 'code':
      return (
      <Code {...props.attributes}>{props.children}</Code>
      )
    default:
      return (
        <span>{props.children}</span>
      )
  }
}
