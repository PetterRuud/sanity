import React, {ReactElement, FunctionComponent, useRef, useMemo} from 'react'
import {Element as SlateElement, Editor, Range} from 'slate'
import {Path} from '@sanity/types'
import {useSelected, useEditor, ReactEditor} from '@sanity/slate-react'
import {PortableTextFeatures} from '../types/portableText'
import TextBlock from './nodes/TextBlock'
import Object from './nodes/DefaultObject'
import {BlockObject as BlockObjectContainer} from './nodes/index'
import {RenderBlockFunction, RenderChildFunction} from '../types/editor'
import {fromSlateValue} from '../utils/values'
import {debugWithName} from '../utils/debug'
import {DraggableBlock} from './DraggableBlock'
import {DraggableChild} from './DraggableChild'
import {ListItem, ListItemInner} from './nodes'
import {KEY_TO_VALUE_ELEMENT} from '../utils/weakMaps'

const debug = debugWithName('components:Element')
const debugRenders = false

type ElementProps = {
  attributes: string
  children: ReactElement
  element: SlateElement
  keyGenerator: () => string
  portableTextFeatures: PortableTextFeatures
  readOnly: boolean
  renderBlock?: RenderBlockFunction
  renderChild?: RenderChildFunction
}

const defaultRender = value => {
  return <Object value={value} />
}

export const Element: FunctionComponent<ElementProps> = ({
  attributes,
  children,
  element,
  keyGenerator,
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

  if (typeof element._type !== 'string') {
    throw new Error(`Expected element to have a _type property`)
  }

  if (typeof element._key !== 'string') {
    throw new Error(`Expected element to have a _key property`)
  }

  // Test for inline objects first
  if (editor.isInline(element)) {
    const path = ReactEditor.findPath(editor, element)
    const [block] = Editor.node(editor, path, {depth: 1})
    const type = portableTextFeatures.types.inlineObjects.find(type => type.name === element._type)
    if (!type) {
      throw new Error('Could not find type for inline block element')
    }
    if (block && typeof block._key === 'string') {
      const path: Path = [{_key: block._key}, 'children', {_key: element._key}]
      debugRenders && debug(`Render ${element._key} (inline object)`)
      const inlineBlockStyle = {display: 'inline-block'}
      return (
        <span {...attributes} style={inlineBlockStyle}>
          <DraggableChild
            element={element}
            readOnly={readOnly}
            spanType={portableTextFeatures.types.span.name}
            keyGenerator={keyGenerator}
          >
            <span
              ref={inlineBlockObjectRef}
              key={element._key}
              style={inlineBlockStyle}
              contentEditable={false}
            >
              {renderChild &&
                renderChild(
                  fromSlateValue(
                    [element],
                    portableTextFeatures.types.block.name,
                    KEY_TO_VALUE_ELEMENT.get(editor)
                  )[0],
                  type,
                  {focused, selected, path},
                  defaultRender,
                  inlineBlockObjectRef
                )}
              {!renderChild &&
                defaultRender(
                  fromSlateValue(
                    [element],
                    portableTextFeatures.types.block.name,
                    KEY_TO_VALUE_ELEMENT.get(editor)
                  )[0]
                )}
              {children}
            </span>
          </DraggableChild>
        </span>
      )
    } else {
      throw new Error('Block not found!')
    }
  }

  let className = ''

  // If not inline, it's either a block (text) or a block object (non-text)
  // NOTE: text blocks aren't draggable with DraggableBlock (yet?)
  switch (element._type) {
    case portableTextFeatures.types.block.name:
      debugRenders && debug(`Render ${element._key} (text block)`)
      const textBlock = (
        <TextBlock
          element={element}
          portableTextFeatures={portableTextFeatures}
          readOnly={readOnly}
        >
          {children}
        </TextBlock>
      )
      const renderedBlock =
        renderBlock &&
        renderBlock(
          fromSlateValue([element], element._type, KEY_TO_VALUE_ELEMENT.get(editor))[0],
          portableTextFeatures.types.block,
          {
            focused,
            selected,
            path: [{_key: element._key}]
          },
          () => textBlock,
          blockObjectRef
        )
      className = `pt-block pt-text-block pt-text-block-style-${element.style}`
      if (element.listItem) {
        className += ` pt-list-item pt-list-item-${element.listItem}`
      }
      return (
        <>
          {renderBlock && !element.listItem && (
            <div ref={blockObjectRef} {...attributes} className={className} key={element._key}>
              {renderedBlock}
            </div>
          )}
          {renderBlock && element.listItem && (
            <ListItem
              ref={blockObjectRef}
              className={className}
              listStyle={element.listItem}
              listLevel={element.level}
              {...attributes}
              key={element._key}
            >
              <ListItemInner className="pt-list-item-inner">{renderedBlock}</ListItemInner>
            </ListItem>
          )}
          {!renderBlock && (
            <div {...attributes} className={className}>
              {textBlock}
            </div>
          )}
        </>
      )
    default:
      const type = portableTextFeatures.types.blockObjects.find(type => type.name === element._type)
      if (!type) {
        throw new Error(`Could not find schema type for block element of _type ${element._type}`)
      }
      className = 'pt-block pt-object-block'
      debugRenders && debug(`Render ${element._key} (object block)`)
      const block = fromSlateValue(
        [element],
        portableTextFeatures.types.block.name,
        KEY_TO_VALUE_ELEMENT.get(editor)
      )[0]
      const renderedBlockFromProps =
        renderBlock &&
        useMemo(() => {
          return renderBlock(
            block,
            type,
            {
              focused,
              selected,
              path: [{_key: block._key}]
            },
            defaultRender,
            blockObjectRef
          )
        }, [block, focused, selected])
      return (
        <div {...attributes} className={className} key={element._key}>
          <DraggableBlock element={element} readOnly={readOnly}>
            <>
              {renderedBlockFromProps && (
                <div ref={blockObjectRef} contentEditable={false}>
                  {renderedBlockFromProps}
                </div>
              )}
              {!renderBlock && (
                <BlockObjectContainer selected={selected} className={className}>
                  {defaultRender(
                    fromSlateValue(
                      [element],
                      portableTextFeatures.types.block.name,
                      KEY_TO_VALUE_ELEMENT.get(editor)
                    )[0]
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
