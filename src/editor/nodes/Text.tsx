import {ComponentType} from 'react'
import React from 'react'
import Blockquote from './Blockquote'
import {TextNormal, TextHeader} from './index'
type Props = {
  style: string
  children: React.ReactNode
  styleComponent?: ComponentType<any>
}
export default function TextComponent(props: Props) {
  const {style, styleComponent, children} = props
  if (styleComponent) {
    const CustomStyle = styleComponent
    return <CustomStyle>{props.children}</CustomStyle>
  }
  switch (style) {
    case 'normal':
      return <TextNormal>{children}</TextNormal>
    case 'blockquote':
      return <Blockquote>{children}</Blockquote>
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return <TextHeader headerStyle={style}>{children}</TextHeader>
    default:
      return <TextNormal>{children}</TextNormal>
  }
}
