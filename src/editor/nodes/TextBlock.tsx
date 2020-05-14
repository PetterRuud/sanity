import React from 'react'
import {Element} from 'slate'
import ListItem from './ListItem'
import Text from './Text'
import {PortableTextFeatures} from '../../types/portableText'
import {TextBlock as TextBlockWrapper} from './index'
import {DraggableBlock} from '../DraggableBlock'

type Props = {
  attributes?: {}
  element: Element
  portableTextFeatures: PortableTextFeatures
  readOnly: boolean
}
export default class TextBlock extends React.Component<Props> {
  render() {
    const {attributes, portableTextFeatures, children, element, readOnly} = this.props
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
      // TODO: Look into this API.
      // Added .portableText as .blockEditor as of May 2020, but kept backward comp.
      styleComponent =
        (customStyle.blockEditor && customStyle.blockEditor.render) ||
        (customStyle.portableText && customStyle.portableText.render)
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
        <DraggableBlock element={element} readOnly={readOnly}>
          <Text style={style} styleComponent={styleComponent}>
            {children}
          </Text>
        </DraggableBlock>
      </TextBlockWrapper>
    )
  }
}
