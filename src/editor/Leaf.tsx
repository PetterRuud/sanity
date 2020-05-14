import React, {ReactElement} from 'react'
import {Element, Range} from 'slate'
import {useSelected, useEditor} from 'slate-react'
import {uniq} from 'lodash'
import Decorator from './nodes/Decorator'
import {DefaultAnnotation} from './nodes/DefaultAnnotation'
import {PortableTextFeatures, PortableTextChild} from '../types/portableText'
import {Type as SchemaType} from '../types/schema'
import {keyGenerator} from './PortableTextEditor'
import {RenderAttributes} from '../types/editor'
import {debugWithName} from '../utils/debug'
import {DraggableChild} from './DraggableChild'
const debug = debugWithName('components:Leaf')
const debugRenders = false

type LeafProps = {
  attributes: string
  children: ReactElement
  leaf: Element
  portableTextFeatures: PortableTextFeatures
  renderChild?: (
    value: PortableTextChild,
    type: SchemaType,
    ref: React.RefObject<HTMLSpanElement>,
    attributes: RenderAttributes,
    defaultRender: (child: PortableTextChild) => JSX.Element
  ) => JSX.Element
  readOnly: boolean
}

export const Leaf = (props: LeafProps) => {
  const editor = useEditor()
  const selected = useSelected()
  const {attributes, children, leaf, portableTextFeatures, renderChild} = props
  const annotationObjectRef = React.useRef(null)
  let returnedChildren = children
  const focused = (selected && editor.selection && Range.isCollapsed(editor.selection)) || false
  if (leaf._type === portableTextFeatures.types.span.name) {
    const decoratorValues = portableTextFeatures.decorators.map(dec => dec.value)
    const marks: string[] = uniq(
      (Array.isArray(leaf.marks) ? leaf.marks : []).filter(mark => decoratorValues.includes(mark))
    )
    marks.map(mark => {
      returnedChildren = (
        <Decorator attributes={attributes} mark={mark}>
          {returnedChildren}
        </Decorator>
      )
    })
    const blockElement = children.props.parent
    const annotations: any[] = (Array.isArray(leaf.marks) ? leaf.marks : [])
      .map(
        mark =>
          !decoratorValues.includes(mark) &&
          blockElement &&
          blockElement.markDefs &&
          blockElement.markDefs.find(def => def._key === mark)
      )
      .filter(Boolean)

    const handleMouseDown = event => {
      // Slate will deselect this when it is already selected and clicked again, so prevent that. 2020/05/04
      if (focused) {
        event.stopPropagation()
        event.preventDefault()
      }
    }
    if (annotations.length > 0) {
      const defaultRender = (annotation: PortableTextChild) => returnedChildren
      if (!renderChild) {
        annotations.map(annotation => {
          returnedChildren = (
            <DefaultAnnotation attributes={attributes} annotation={annotation}>
              {returnedChildren}
            </DefaultAnnotation>
          )
        })
      } else {
        annotations.map(annotation => {
          const type = portableTextFeatures.types.annotations.find(t => t.name === annotation._type)
          const path = [{_key: blockElement._key}, 'children', {_key: leaf._key}]
          if (type) {
            returnedChildren = (
              <span ref={annotationObjectRef} key={keyGenerator()} onMouseDown={handleMouseDown}>
                {renderChild(
                  annotation,
                  type,
                  annotationObjectRef,
                  {focused, selected, path, annotations},
                  defaultRender
                )}
              </span>
            )
          }
        })
      }
    }
  }
  debugRenders && debug(`Render ${leaf._key} (span)`)
  // TODO: remove hightlight stuff as test for decorations
  return (
    <span
      {...attributes}
      style={{backgroundColor: leaf.__highlight ? '#ff0' : '#fff'}}
      ref={annotationObjectRef}
    >
      <DraggableChild
        element={leaf}
        readOnly={props.readOnly}
        spanType={portableTextFeatures.types.span.name}
      >
        {returnedChildren}
      </DraggableChild>
    </span>
  )
}
