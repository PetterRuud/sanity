import React, {ReactElement} from 'react'
import {Element, Range} from 'slate'
import {useSelected, useEditor} from '@sanity/slate-react'
import {uniq} from 'lodash'
import {DefaultAnnotation} from './nodes/DefaultAnnotation'
import {PortableTextFeatures, PortableTextBlock, PortableTextChild} from '../types/portableText'
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
  renderAnnotation?: (
    value: PortableTextBlock,
    type: SchemaType,
    ref: React.RefObject<HTMLSpanElement>,
    attributes: RenderAttributes,
    defaultRender: () => JSX.Element
  ) => JSX.Element
  renderChild?: (
    value: PortableTextChild,
    type: SchemaType,
    ref: React.RefObject<HTMLSpanElement>,
    attributes: RenderAttributes,
    defaultRender: (child: PortableTextChild) => JSX.Element
  ) => JSX.Element
  renderDecorator?: (
    value: string,
    type: {title: string},
    ref: React.RefObject<HTMLSpanElement>,
    attributes: RenderAttributes,
    defaultRender: () => JSX.Element
  ) => JSX.Element
  readOnly: boolean
}

export const Leaf = (props: LeafProps) => {
  const editor = useEditor()
  const selected = useSelected()
  const {attributes, children, leaf, portableTextFeatures} = props
  const spanRef = React.useRef(null)
  let returnedChildren = children
  const focused = (selected && editor.selection && Range.isCollapsed(editor.selection)) || false
  if (leaf._type === portableTextFeatures.types.span.name) {
    const blockElement = children.props.parent
    const path = [{_key: blockElement._key}, 'children', {_key: leaf._key}]
    const decoratorValues = portableTextFeatures.decorators.map(dec => dec.value)
    const marks: string[] = uniq(
      (Array.isArray(leaf.marks) ? leaf.marks : []).filter(mark => decoratorValues.includes(mark))
    )
    marks.map(mark => {
      const type = portableTextFeatures.decorators.find(dec => dec.value === mark)
      const defaultRender = () => <>{returnedChildren}</>
      if (type) {
        // TODO: look into this API!
        if (type?.blockEditor?.render) {
          const CustomComponent = type?.blockEditor?.render
          returnedChildren = <CustomComponent mark={mark}>{returnedChildren}</CustomComponent>
        }
        if (props.renderDecorator) {
          returnedChildren = props.renderDecorator(
            mark,
            type,
            spanRef,
            {focused, selected, path},
            defaultRender
          )
        }
      }
    })

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
      annotations.map(annotation => {
        const type = portableTextFeatures.types.annotations.find(t => t.name === annotation._type)
        // TODO: look into this API!
        const CustomComponent = type?.blockEditor?.render
        const defaultRender = (): JSX.Element =>
          // TODO: annotation should be an own prop here, keeping for backward compability (2020/05/18).
          CustomComponent ? (
            <CustomComponent {...annotation} attributes={attributes}>{returnedChildren}</CustomComponent>
          ) : (
            <>{returnedChildren}</>
          )

        if (type) {
          if (!props.renderAnnotation) {
            returnedChildren = (
              <DefaultAnnotation attributes={attributes} annotation={annotation}>
                <span ref={spanRef} key={keyGenerator()} onMouseDown={handleMouseDown}>
                  {defaultRender()}
                </span>
              </DefaultAnnotation>
            )
          } else {
            returnedChildren = (
              <span ref={spanRef} key={keyGenerator()}>
                {props.renderAnnotation(
                  annotation,
                  type,
                  spanRef,
                  {focused, selected, path, annotations},
                  defaultRender
                )}
              </span>
            )
          }
        }
      })
    }
  }
  debugRenders && debug(`Render ${leaf._key} (span)`)
  // TODO: remove hightlight stuff as test for decorations
  return (
    <span
      {...attributes}
      style={{backgroundColor: leaf.__highlight ? '#ff0' : 'inherit'}}
      ref={spanRef}
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
