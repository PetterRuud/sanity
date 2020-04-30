import React, {ReactElement} from 'react'
import {Element} from 'slate'
import {uniq} from 'lodash'
import Decorator from './nodes/Decorator'
import Annotation from './nodes/Annotation'
import {PortableTextFeatures, PortableTextBlock, PortableTextChild} from '../types/portableText'
import {Type as SchemaType} from 'src/types/schema'

type LeafProps = {
  block: PortableTextBlock
  attributes: string
  children: ReactElement
  leaf: Element
  portableTextFeatures: PortableTextFeatures
  renderChild?: (
    value: PortableTextChild,
    type: SchemaType,
    ref: React.RefObject<HTMLSpanElement>,
    attributes: {focused: boolean, selected: boolean},
    defaultRender: (child: PortableTextChild) => JSX.Element
  ) => JSX.Element
}

export const Leaf = (props: LeafProps) => {
  const {attributes, children, leaf, portableTextFeatures} = props
  let returnedChildren = children
  if (leaf._type === portableTextFeatures.types.span.name) {
    const decoratorValues = portableTextFeatures.decorators.map(dec => dec.value)
    const marks: string[] = uniq((leaf.marks || []).filter(mark => decoratorValues.includes(mark)))
    marks.map(mark => {
      returnedChildren = (
        <Decorator attributes={attributes} mark={mark}>
          {returnedChildren}
        </Decorator>
      )
    })
    const annotations: PortableTextBlock[] = (leaf.marks || [])
      .map(
        mark =>
          !decoratorValues.includes(mark) && props.block.markDefs.find(def => def._key === mark)
      )
      .filter(Boolean)

    annotations.map(annotation => {
      returnedChildren = (
        <Annotation attributes={attributes} annotation={annotation}>
          {returnedChildren}
        </Annotation>
      )
    })
  }


  // TODO: remove hightlight stuff as test for decorations
  return (
    <span {...attributes} style={{backgroundColor: leaf.highlight ? '#ff0' : '#fff'}}>
      {returnedChildren}
    </span>
  )
}
