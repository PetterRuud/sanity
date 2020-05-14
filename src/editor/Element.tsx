import React, {ReactElement, FunctionComponent, useRef} from 'react'
import {Element as SlateElement, Editor, Range} from 'slate'
import {useSelected, useEditor, ReactEditor} from 'slate-react'
import {PortableTextFeatures, PortableTextBlock, PortableTextChild} from '../types/portableText'
import TextBlock from './nodes/TextBlock'
import Object from './nodes/DefaultObject'
import {BlockObject as BlockObjectContainer} from './nodes/index'
import {Type as SchemaType} from '../types/schema'
import {RenderAttributes} from '../types/editor'
import {fromSlateValue} from '../utils/values'
import {keyGenerator} from './PortableTextEditor'
import {debugWithName} from '../utils/debug'
import {DraggableBlock} from './DraggableBlock'
import {DraggableChild} from './DraggableChild'

const debug = debugWithName('components:Element')
const debugRenders = false

type ElementProps = {
  attributes: string
  children: ReactElement
  element: SlateElement
  portableTextFeatures: PortableTextFeatures
  readOnly: boolean
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
  attributes,
  children,
  element,
  portableTextFeatures,
  readOnly,
  renderBlock,
  renderChild
}) => {
  const editor = useEditor()
  const selected = useSelected()
  const blockObjectRef = useRef(null)
  const inlineBlockObjectRef = useRef(null)
  const focused = (selected && editor.selection && Range.isCollapsed(editor.selection)) || false
  // Test for inline objects first
  if (editor.isInline(element)) {
    const path = ReactEditor.findPath(editor, element)
    const [block] = Editor.node(editor, path, {depth: 1})
    const type = portableTextFeatures.types.inlineObjects.find(type => type.name === element._type)
    if (!type) {
      throw new Error('Could not find type for inline block element')
    }
    if (block) {
      const path = [{_key: block._key}, 'children', {_key: element._key}]
      debugRenders && debug(`Render ${element._key} (inline object)`)
      const inlineBlockStyle = {display: 'inline-block'}
      return (
        <div {...attributes} contentEditable={false} style={inlineBlockStyle}>
          <DraggableChild
            element={element}
            readOnly={readOnly}
            spanType={portableTextFeatures.types.span.name}
          >
            <div ref={inlineBlockObjectRef} key={element._key} style={inlineBlockStyle}>
              {renderChild &&
                renderChild(
                  fromSlateValue([element], portableTextFeatures.types.block.name)[0],
                  type,
                  inlineBlockObjectRef,
                  {focused, selected, path},
                  defaultRender
                )}
              {!renderChild &&
                defaultRender(fromSlateValue([element], portableTextFeatures.types.block.name)[0])}
              {children}
            </div>
          </DraggableChild>
        </div>
      )
    } else {
      throw new Error('Block not found!')
    }
  }
  // If not inline, it's either a block (text) or a block object (non-text)
  // NOTE: text blocks aren't draggable with DraggableBlock (yet?)
  switch (element._type) {
    case portableTextFeatures.types.block.name:
      debugRenders && debug(`Render ${element._key} (text block)`)
      return (
        <TextBlock
          attributes={attributes}
          element={element}
          portableTextFeatures={portableTextFeatures}
          readOnly={readOnly}
        >
          {children}
        </TextBlock>
      )
    default:
      const type = portableTextFeatures.types.blockObjects.find(type => type.name === element._type)
      if (!type) {
        throw new Error(`Could not find type for block element of _type ${element._type}`)
      }
      debugRenders && debug(`Render ${element._key} (block)`)
      return (
        <div {...attributes} contentEditable={false}>
          <DraggableBlock element={element} readOnly={readOnly}>
            <>
              {renderBlock && (
                <div ref={blockObjectRef} key={keyGenerator()}>
                  {renderBlock(
                    fromSlateValue([element], portableTextFeatures.types.block.name)[0],
                    type,
                    blockObjectRef,
                    {focused, selected, path: [{_key: element._key}]},
                    defaultRender
                  )}
                </div>
              )}
              {!renderBlock && (
                <BlockObjectContainer selected={selected}>
                  {defaultRender(
                    fromSlateValue([element], portableTextFeatures.types.block.name)[0]
                  )}
                </BlockObjectContainer>
              )}
              {children}
            </>
          </DraggableBlock>
        </div>
      )
  }
}
