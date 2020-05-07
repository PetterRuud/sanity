import React from 'react'
import {TextStrong, TextEmphasis, TextCode, TextUnderline, TextStrikeThrough} from './index'

type Props = {
  attributes: {}
  mark: string
  children: React.ReactNode
}
export default function DecoratorComponent(props: Props) {
  switch (props.mark) {
    case 'strong':
      return <TextStrong {...props.attributes}>{props.children}</TextStrong>
    case 'em':
      return <TextEmphasis {...props.attributes}>{props.children}</TextEmphasis>
    case 'underline':
      return <TextUnderline {...props.attributes}>{props.children}</TextUnderline>
    case 'strike-through':
      return <TextStrikeThrough {...props.attributes}>{props.children}</TextStrikeThrough>
    case 'code':
      return <TextCode {...props.attributes}>{props.children}</TextCode>
    default:
      return <span {...props.attributes}>{props.children}</span>
  }
}
