import React from 'react'
const LIST_ITEM_TYPES = ['bullet', 'number', 'roman']
type Props = {
  listStyle: string
  level: number
  children: React.ReactNode
  attributes?: {}
}
import {ListItem, ListItemInner} from './index'

export default function ListItemComponent(props: Props) {
  const attributes = props.attributes || {}
  const {listStyle, level} = props
  if (!LIST_ITEM_TYPES.includes(listStyle)) {
    throw new Error(
      `Don't know how to handle listItem '${listStyle}'. ` +
        `Expected one of '${LIST_ITEM_TYPES.join("', '")}'`
    )
  }
  return (
    <ListItem {...attributes}>
      <ListItemInner level={level} listStyle={listStyle}>{props.children}</ListItemInner>
    </ListItem>
  )
}
