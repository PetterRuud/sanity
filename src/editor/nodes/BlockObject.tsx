import React from 'react'
import {BlockObject as BlockObjectContainer} from './index'

export function BlockObject(props) {
  const {block, focused, selected, renderBlock} = props
  return (
    <div contentEditable={false}>
      <BlockObjectContainer focused={focused} selected={selected}>
        {renderBlock && props.renderBlock(block)}
        {!renderBlock && JSON.stringify(block)}
      </BlockObjectContainer>
    </div>
  )
}
