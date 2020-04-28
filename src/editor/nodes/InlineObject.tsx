import React from 'react'
import {InlineObject as InlineObjectContainer} from './index'
import {PortableTextChild} from '../../types/portableText'

type Props = {
  focused: boolean
  selected: boolean
  value: PortableTextChild,
  renderChild?: (
    child: PortableTextChild,
    attributes: {focused: boolean; selected: boolean}
  ) => JSX.Element
}

export class InlineObject extends React.Component<Props, {}> {
  render() {
    const {focused, selected, value, renderChild} = this.props
    return (
      <span contentEditable={false}>
        <InlineObjectContainer focused={focused} selected={selected}>
          {renderChild && renderChild(value, {focused, selected})}
          {!renderChild && JSON.stringify(value)}
        </InlineObjectContainer>
      </span>
    )
  }
}
