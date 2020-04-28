import React, {ReactElement} from 'react'
import {Element as SlateElement} from 'slate'
import {useFocused, useSelected, useEditor} from 'slate-react'
import {PortableTextFeatures, PortableTextBlock, PortableTextChild} from '../types/portableText'
import Block from './nodes/TextBlock'
import {InlineObject} from './nodes/InlineObject'
import {BlockObject} from './nodes/BlockObject'
import {Type as SchemaType} from '../types/schema'

type ElementProps = {
  attributes: string
  children: ReactElement
  element: SlateElement
  block: PortableTextBlock
  type: SchemaType
  value: PortableTextBlock
  portableTextFeatures: PortableTextFeatures
  renderBlock?: (
    block: PortableTextBlock,
    type: SchemaType,
    ref: React.RefObject<HTMLDivElement>,
    attributes: {focused: boolean, selected: boolean},
    defaultRender: (block: PortableTextBlock) => JSX.Element
  ) => JSX.Element
  renderChild?: (
    child: PortableTextChild,
    attributes: {focused: boolean; selected: boolean}
  ) => JSX.Element
}

export const Element = (props: ElementProps) => {
  const editor = useEditor()
  const selected = useSelected()
  const focused = useFocused()
  const {
    value,
    attributes,
    children,
    element,
    portableTextFeatures,
    type,
    renderBlock,
    renderChild
  } = props
  // Test for inline objects first
  if (editor.isInline(element)) {
    return (
      <InlineObject
        value={value}
        focused={focused}
        renderChild={renderChild}
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
          <BlockObject
            value={value}
            type={type}
            selected={selected}
            focused={focused}
            renderBlock={renderBlock}
          />
          {children}
        </div>
      )
  }
}
