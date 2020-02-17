import React from 'react'
import {BlockObject as BlockObjectContainer} from './index'

export function BlockObject(props) {
  return (
    <div contentEditable={false}>
      <BlockObjectContainer focused={props.focused} selected={props.selected}>
        {JSON.stringify(props.element.value)}
      </BlockObjectContainer>
    </div>
  )
}
