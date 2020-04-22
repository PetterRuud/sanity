import React, {ReactElement} from 'react'
import {Element as SlateElement} from 'slate'
import {useSlate, useFocused, useSelected} from 'slate-react'
import {PortableTextFeatures, PortableTextBlock, PortableTextChild} from '../types/portableText'
import Block from './nodes/TextBlock'
import {InlineObject} from './nodes/InlineObject'
import {BlockObject} from './nodes/BlockObject'
import {Type as SchemaType} from 'src/types/schema'

type ElementProps = {
  attributes: string
  children: ReactElement
  element: SlateElement
  block: PortableTextBlock
  type: SchemaType
  child?: PortableTextChild
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
  const editor = useSlate()
  const selected = useSelected()
  const focused = useFocused()
  const {
    attributes,
    children,
    element,
    portableTextFeatures,
    block,
    type,
    child,
    renderBlock,
    renderChild
  } = props
  // Test for inline objects first
  if (editor.isInline(element) && child) {
    return (
      <InlineObject
        child={child}
        attributes={attributes}
        element={element}
        focused={focused}
        selected={selected}
        renderChild={renderChild}
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
            block={block}
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
