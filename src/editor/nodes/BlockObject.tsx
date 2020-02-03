import React from 'react'
import {BlockObject as BlockObjectContainer} from './index'

export function BlockObject(props) {
  return (
    <div {...props.attributes} contentEditable={false}>
      <BlockObjectContainer focused={props.focused} selected={props.selected}>
        Focused: {props.focused === true ? 'true' : 'false'}
        {JSON.stringify(props.element)}
      </BlockObjectContainer>
    </div>
  )
}
