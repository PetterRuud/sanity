import React, {ReactElement} from 'react'
import {Element} from 'slate'
import {uniq} from 'lodash'
import Decorator from './nodes/Decorator'
import {PortableTextFeatures} from '../types/portableText'

type LeafProps = {
  attributes: string
  children: ReactElement
  leaf: Element
  portableTextFeatures: PortableTextFeatures
}

export const SlateLeaf = (props: LeafProps) => {
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
  // TODO: remove hightlight stuff as test for decorations
  return <span {...attributes} style={{backgroundColor: leaf.highlight ? '#ff0' : '#fff'}}>{returnedChildren}</span>
}
