import React from 'react'
import ListItem from './ListItem'
import Text from './Text'
import {PortableTextFeatures} from '../../types/portableText'
import {TextBlock} from './index'

type Props = {
  attributes?: {}
  block: any
  portableTextFeatures: PortableTextFeatures
}
export default class Block extends React.Component<Props, {}> {
  render() {
    const {attributes, portableTextFeatures, children, block} = this.props
    const listItem = block.listItem || null
    const level = block.level || 1
    const style = block.style || 'normal'
    // Should we render a custom style?
    let styleComponent
    const customStyle =
    portableTextFeatures && style
        ? portableTextFeatures.styles.find(item => item.value === style)
        : null
    if (customStyle) {
      styleComponent = customStyle.blockEditor && customStyle.blockEditor.render
    }
    if (listItem) {
      return (
        <ListItem attributes={attributes} level={level} listStyle={listItem}>
          <Text style={style} styleComponent={styleComponent}>
            {children}
          </Text>
        </ListItem>
      )
    }
    return (
      <TextBlock {...attributes}>
        <Text style={style} styleComponent={styleComponent}>
          {children}
        </Text>
      </TextBlock>
    )
  }
}
