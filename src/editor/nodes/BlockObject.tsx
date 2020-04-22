import React from 'react'
import {BlockObject as BlockObjectContainer} from './index'
import {PortableTextBlock} from 'src/types/portableText'
import {Type as SchemaType} from 'src/types/schema'
import DefaultBlock from './DefaultBlock'

type BlockObjectProps = {
  block: PortableTextBlock,
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
  const {block, type, focused, selected, renderBlock} = props
  const blockObjectRef = React.useRef(null)

  return (
    <div contentEditable={false} ref={blockObjectRef}>
      <BlockObjectContainer selected={selected}>
        {renderBlock && renderBlock(block, type, blockObjectRef, { focused, selected }, defaultRender)}
      </BlockObjectContainer>
    </div>
  )
}
