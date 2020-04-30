import React, {ReactElement, FunctionComponent} from 'react'
import {Element as SlateElement} from 'slate'
import {useFocused, useSelected, useEditor} from 'slate-react'
import {PortableTextFeatures, PortableTextBlock, PortableTextChild} from '../types/portableText'
import Block from './nodes/TextBlock'
import DefaultBlock from './nodes/DefaultBlock'
import {InlineObject as InlineObjectContainer, BlockObject as BlockObjectContainer} from './nodes/index'
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
    value: PortableTextBlock,
    type: SchemaType,
    ref: React.RefObject<HTMLDivElement>,
    attributes: {focused: boolean; selected: boolean},
    defaultRender: (block: PortableTextBlock) => JSX.Element
  ) => JSX.Element
  renderChild?: (
    value: PortableTextChild,
    type: SchemaType,
    ref: React.RefObject<HTMLSpanElement>,
    attributes: {focused: boolean, selected: boolean},
    defaultRender: (child: PortableTextChild) => JSX.Element
  ) => JSX.Element
}

const defaultRender = child => {
  return <DefaultBlock block={child} />
}

export const Element: FunctionComponent<ElementProps> = ({
  value,
  attributes,
  children,
  element,
  portableTextFeatures,
  type,
  renderBlock,
  renderChild
}) => {
  const editor = useEditor()
  const selected = useSelected()
  const focused = useFocused()
  const blockObjectRef = React.useRef(null)
  const inlineBlockObjectRef = React.useRef(null)
  // Test for inline objects first
  if (editor.isInline(element)) {
    return (
      <span {...attributes}>
        <span ref={inlineBlockObjectRef}>
          <InlineObjectContainer selected={selected}>
            {renderChild && renderChild(value, type, inlineBlockObjectRef, {focused, selected}, defaultRender)}
          </InlineObjectContainer>
        </span>
        {children}
      </span>
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
          <div ref={blockObjectRef}>
            <BlockObjectContainer selected={selected}>
              {renderBlock &&
                renderBlock(value, type, blockObjectRef, {focused, selected}, defaultRender)}
            </BlockObjectContainer>
          </div>
          {children}
        </div>
      )
  }
}
