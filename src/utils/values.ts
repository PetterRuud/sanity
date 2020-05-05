import {isEqual} from 'lodash'
import {Node} from 'slate'
import {PortableTextBlock} from '../types/portableText'
import {PathSegment} from '../types/path'

type Partial<T> = {
  [P in keyof T]?: T[P]
}

export function toSlateValue(
  value: PortableTextBlock[] | undefined,
  textBlockType: string
): Node[] {
  if (value && Array.isArray(value)) {
    return value.map(block => {
      const {_type, _key, ...rest} = block
      const isPortableText = block && block._type === textBlockType
      if (isPortableText) {
        const children = block.children.map(child => {
          const {_type, _key, ...rest} = child
          if (_type !== 'span') {
            return {_type, _key, children: [{text: ''}], value: rest, __inline: true}
          } else {
            return child
          }
        })
        return {_type, _key, ...rest, children}
      }
      return {_type, _key, children: [{text: ''}], value: rest}
    })
  }
  return []
}

export function fromSlateValue(
  value: (Node | Partial<Node>)[],
  textBlockType: string
): PortableTextBlock[] {
  if (value && Array.isArray(value)) {
    return value.map(block => {
      const isPortableText = block && block._type === textBlockType
      if (isPortableText) {
        const children = block.children.map(child => {
          const {_type} = child
          if (_type !== 'span') {
            const {value, children, __inline, ...rest} = child
            return {...rest, ...value}
          } else {
            return child
          }
        })
        return {...block, children}
      }
      const {_key, _type} = block
      return {_key, _type, ...block.value}
    })
  }
  return value
}

export function isEqualToEmptyEditor(children, portableTextFeatures) {
  return (
    children === undefined ||
    (children && Array.isArray(children) && children.length === 0) ||
    (children &&
      Array.isArray(children) &&
      children.length === 1 &&
        children[0]._type === portableTextFeatures.types.block.name &&
        children[0].children &&
        children[0].children.length === 1 &&
        children[0].children[0]._type === 'span' &&
        children[0].children[0].text === '')
  )
}

export function findBlockAndIndexFromPath(
  firstPathSegment: PathSegment,
  children: Node[]
): [Node | undefined, number] {
  let blockIndex = -1
  const isNumber = Number.isInteger(Number(firstPathSegment))
  if (isNumber) {
    blockIndex = Number(firstPathSegment)
  } else if (children) {
    blockIndex = children.findIndex(blk => isEqual({_key: blk._key}, firstPathSegment))
  }
  if (blockIndex > -1) {
    return [children[blockIndex], blockIndex]
  }
  return [undefined, -1]
}

export function findChildAndIndexFromPath(
  secondPathSegment: PathSegment,
  block: Node
): [Node | undefined, number] {
  let childIndex = -1
  const isNumber = Number.isInteger(Number(secondPathSegment))
  if (isNumber) {
    childIndex = Number(secondPathSegment)
  } else {
    childIndex = block.children.findIndex(child => isEqual({_key: child._key}, secondPathSegment))
  }
  if (childIndex > -1) {
    return [block.children[childIndex], childIndex]
  }
  return [undefined, -1]
}
