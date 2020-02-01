import React, {ReactElement} from 'react'
import {uniq} from 'lodash'
import Decorator from './nodes/Decorator'
import {EditorNode} from '../types/editor'
import {PortableTextFeatures} from '../types/portableText'

type LeafProps = {
  attributes: string
  children: ReactElement
  leaf: EditorNode
  portableTextFeatures: PortableTextFeatures
}

export const Leaf = (props: LeafProps) => {
  const {attributes, children, leaf, portableTextFeatures} = props
  let returnedChildren = children
  if (leaf._type === 'span') {
    const marks: string[] = uniq(
      (leaf.marks || []).filter(mark =>
        portableTextFeatures.decorators.map(dec => dec.value).includes(mark)
      )
    )
    marks.map(mark => {
      returnedChildren = (
        <Decorator attributes={attributes} mark={mark}>
          {returnedChildren}
        </Decorator>
      )
    })
  }
  return <span {...attributes}>{returnedChildren}</span>
}
