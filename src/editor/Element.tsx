import React, {ReactElement, FunctionComponent} from 'react'
import {Element as SlateElement, Editor, Range} from 'slate'
import {useSelected, useEditor} from 'slate-react'
import {PortableTextFeatures, PortableTextBlock, PortableTextChild} from '../types/portableText'
import Block from './nodes/TextBlock'
import Object from './nodes/DefaultObject'
import {
  InlineObject as InlineObjectContainer,
  BlockObject as BlockObjectContainer
} from './nodes/index'
import {Type as SchemaType} from '../types/schema'
import {RenderAttributes} from '../types/editor'
import {fromSlateValue} from '../utils/values'
import {keyGenerator} from './PortableTextEditor'

type ElementProps = {
  attributes: string
  children: ReactElement
  element: SlateElement
  block: PortableTextBlock
  value: PortableTextBlock
  portableTextFeatures: PortableTextFeatures
  renderBlock?: (
    value: PortableTextBlock,
    type: SchemaType,
    ref: React.RefObject<HTMLDivElement>,
    attributes: RenderAttributes,
    defaultRender: (block: PortableTextBlock) => JSX.Element
  ) => JSX.Element
  renderChild?: (
    value: PortableTextChild,
    type: SchemaType,
    ref: React.RefObject<HTMLSpanElement>,
    attributes: RenderAttributes,
    defaultRender: (child: PortableTextChild) => JSX.Element
  ) => JSX.Element
}

const defaultRender = value => {
  return <Object value={value} />
}

export const Element: FunctionComponent<ElementProps> = ({
  value,
  attributes,
  children,
  element,
  portableTextFeatures,
  renderBlock,
  renderChild
}) => {
  const editor = useEditor()
  const selected = useSelected()
  const blockObjectRef = React.useRef(null)
  const inlineBlockObjectRef = React.useRef(null)
  const focused = selected && editor.selection && Range.isCollapsed(editor.selection) || false
  // Test for inline objects first
  // TODO: This is probably not the best way to find the child's block.
  if (editor.isInline(element)) {
    const [block] = Array.from(
      Editor.nodes(editor, {
        at: [],
        match: n => n.children && n.children.find(c => c._key === value._key)
      })
    )[0]
    const type = portableTextFeatures.types.inlineObjects.find(type => type.name === value._type)
    if (!type) {
      throw new Error('Could not find type for inline block element')
    }
    if (block) {
      const blockValue = fromSlateValue([block], portableTextFeatures.types.block.name)[0]
      const path = [{_key: blockValue._key}, 'children', {_key: value._key}]

      // Slate will deselect this when it is already selected and clicked again, so prevent that. 2020/05/04
      const handleMouseDown = event => {
        if (focused) {
          event.stopPropagation()
          event.preventDefault()
        }
      }
      return (
        <span {...attributes}>
          {renderChild && (
            <span ref={inlineBlockObjectRef} key={keyGenerator()} onMouseDown={handleMouseDown}>
              {renderChild(
                value,
                type,
                inlineBlockObjectRef,
                {focused, selected, path},
                defaultRender
              )}
            </span>
          )}
          {!renderChild && (
            <InlineObjectContainer selected={selected}>
              {defaultRender(value)}
            </InlineObjectContainer>
          )}
          {children}
        </span>
      )
    } else {
      throw new Error('Block not found!')
    }
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
      const type = portableTextFeatures.types.blockObjects.find(type => type.name === value._type)
      if (!type) {
        throw new Error('Could not find type for block element')
      }
      const handleMouseDown = event => {
        // Slate will deselect this when it is already selected and clicked again, so prevent that. 2020/05/04
        if (focused) {
          event.stopPropagation()
          event.preventDefault()
        }
      }
      return (
        <div {...attributes}>
          {renderBlock && (
            <div ref={blockObjectRef} key={keyGenerator()} onMouseDown={handleMouseDown}>
              {renderBlock(
                value,
                type,
                blockObjectRef,
                {focused, selected, path: [{_key: value._key}]},
                defaultRender
              )}
            </div>
          )}
          {!renderBlock && (
            <BlockObjectContainer selected={selected}>{defaultRender(value)}</BlockObjectContainer>
          )}
          {children}
        </div>
      )
  }
}
