import React, {ReactElement} from 'react'
import {Element} from 'slate'
import {useSlate, useFocused, useSelected} from 'slate-react'
import {PortableTextFeatures} from '../types/portableText'
import Block from './nodes/TextBlock'
import {InlineObject} from './nodes/InlineObject'
import {BlockObject} from './nodes/BlockObject'

type ElementProps = {
  attributes: string
  children: ReactElement
  element: Element
  portableTextFeatures: PortableTextFeatures
}

export const SlateElement = (props: ElementProps) => {
  const editor = useSlate()
  const selected = useSelected()
  const focused = useFocused()
  const {attributes, children, element, portableTextFeatures} = props
  // Test for inline objects first
  if (editor.isInline(element)) {
    return (
      <InlineObject
        attributes={attributes}
        element={element}
        focused={focused}
        selected={selected}
      />
    )
  }
  // If not inline, it's either a block (text) or a block object (non-text)
  switch (element._type) {
    case portableTextFeatures.types.block.name:
      return (
        <Block
          attributes={attributes}
          element={element}
          portableTextFeatures={portableTextFeatures}
        >
          {children}
        </Block>
      )
    default:
      return (
        <div {...attributes}>
          <BlockObject element={element} selected={selected} editor={editor} />
          {children}
        </div>
      )
  }
}
