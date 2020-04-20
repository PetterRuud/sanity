import React, { FunctionComponent } from 'react'
import {BlockObject as BlockObjectContainer} from './index'
import { PortableTextBlock } from 'src/types/portableText'
import { Type as SchemaType } from 'src/types/schema'

type BlockObjectProps = {
  block: PortableTextBlock,
  type: SchemaType,
  focused: boolean,
  selected: boolean,
  renderBlock?: (
    block: PortableTextBlock,
    type: SchemaType,
    attributes: {focused: boolean, selected: boolean},
    defaultRender: () => string
  ) => JSX.Element
}

export const BlockObject = (props: BlockObjectProps) => {
  const {block, type, focused, selected, renderBlock} = props
  console.log(block)
  return (
    <div contentEditable={false}>
      <BlockObjectContainer selected={selected}>
        {renderBlock && renderBlock(block, type, { focused, selected }, () => JSON.stringify(block))}
      </BlockObjectContainer>
    </div>
  )
}
