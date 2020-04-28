import React from 'react'
import {BlockObject as BlockObjectContainer} from './index'
import {PortableTextBlock} from 'src/types/portableText'
import {Type as SchemaType} from 'src/types/schema'
import DefaultBlock from './DefaultBlock'

type BlockObjectProps = {
  value: PortableTextBlock,
  type: SchemaType,
  focused: boolean,
  selected: boolean,
  renderBlock?: (
    block: PortableTextBlock,
    type: SchemaType,
    ref: React.RefObject<HTMLDivElement>,
    attributes: {focused: boolean, selected: boolean},
    defaultRender: (block: PortableTextBlock) => JSX.Element
  ) => JSX.Element
}

const defaultRender = block => {
  return <DefaultBlock block={block} />
}

export const BlockObject = (props: BlockObjectProps) => {
  const {value, type, focused, selected, renderBlock} = props
  const blockObjectRef = React.useRef(null)

  return (
    <div ref={blockObjectRef}>
      <BlockObjectContainer selected={selected}>
        {renderBlock && renderBlock(value, type, blockObjectRef, { focused, selected }, defaultRender)}
      </BlockObjectContainer>
    </div>
  )
}
