import React, {ReactElement} from 'react'
import {EditorNode} from '../types/editor'
import {PortableTextFeatures} from '../types/portableText'
import Block from './nodes/Block'

type ElementProps = {
  attributes: string
  children: ReactElement
  element: EditorNode
  portableTextFeatures: PortableTextFeatures
}

export const Element = (props: ElementProps) => {
  const {attributes, children, element, portableTextFeatures} = props
  switch (element._type) {
    case portableTextFeatures.types.block.name:
      return (
        <Block attributes={attributes} block={element} portableTextFeatures={portableTextFeatures}>
          {children}
        </Block>
      )
    default:
      return <p {...attributes}>{children}</p>
  }
}
