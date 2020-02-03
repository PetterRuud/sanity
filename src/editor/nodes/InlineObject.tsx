import React from 'react'
import {Element} from 'slate'
import {InlineObject as InlineObjectContainer} from './index'

type Props = {
  element: Element
  focused: boolean
  selected: boolean
  attributes: {}
}

export class InlineObject extends React.Component<Props, {}> {
  render() {
    const {attributes, focused, selected, element} = this.props
    return (
      <span {...attributes} contentEditable={false}>
        <InlineObjectContainer focused={focused} selected={selected}>
          Focused: {focused === true ? 'true' : 'false'}
          {JSON.stringify(element)}
        </InlineObjectContainer>
      </span>
    )
  }
}
