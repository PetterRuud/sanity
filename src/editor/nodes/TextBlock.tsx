import React from 'react'
import {Element} from 'slate'
import ListItem from './ListItem'
import Text from './Text'
import {PortableTextFeatures} from '../../types/portableText'
import {TextBlock as TextBlockWrapper} from './index'

type Props = {
  attributes?: {}
  element: Element
  portableTextFeatures: PortableTextFeatures
}
export default class TextBlock extends React.PureComponent<Props, {}> {
  render() {
    const {attributes, portableTextFeatures, children, element} = this.props
    const listItem = element.listItem || undefined
    const level = element.level || 1
    const style = element.style || 'normal'
    // Should we render a custom style?
    let styleComponent
    const customStyle =
      portableTextFeatures && style
        ? portableTextFeatures.styles.find(item => item.value === style)
        : undefined
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
      <TextBlockWrapper {...attributes}>
        <Text style={style} styleComponent={styleComponent}>
          {children}
        </Text>
      </TextBlockWrapper>
    )
  }
}
