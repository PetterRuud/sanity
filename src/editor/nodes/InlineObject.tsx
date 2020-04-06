import React from 'react'
import {Element} from 'slate'
import {InlineObject as InlineObjectContainer} from './index'
import {PortableTextChild} from '../../types/portableText'

type Props = {
  element: Element
  focused: boolean
  selected: boolean
  attributes: {}
  child: PortableTextChild,
  renderChild?: (
    child: PortableTextChild,
    attributes: {focused: boolean; selected: boolean}
  ) => JSX.Element
}

export class InlineObject extends React.Component<Props, {}> {
  render() {
    const {attributes, focused, selected, child, renderChild} = this.props
    return (
      <span {...attributes} contentEditable={false}>
        <InlineObjectContainer focused={focused} selected={selected}>
          {renderChild && renderChild(child, {focused, selected})}
          {!renderChild && JSON.stringify(child)}
        </InlineObjectContainer>
      </span>
    )
  }
}
