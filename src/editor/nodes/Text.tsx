import {ComponentType} from 'react'
import React from 'react'
import Blockquote from './Blockquote'
import {Normal, Header} from './index'
type Props = {
  style: string
  children: React.ReactNode
  styleComponent?: ComponentType<any>
}
export default function TextComponent(props: Props) {
  const {style, styleComponent} = props
  if (styleComponent) {
    const CustomStyle = styleComponent
    return <CustomStyle>{props.children}</CustomStyle>
  }
  switch (style) {
    case 'normal':
      return <Normal>{props.children}</Normal>
    case 'blockquote':
      return <Blockquote>{props.children}</Blockquote>
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return <Header>{props.children}</Header>
    default:
      return <Normal>{props.children}</Normal>
  }
}
