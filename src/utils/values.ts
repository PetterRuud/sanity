import {isEqual} from 'lodash'
import {Node, Element} from 'slate'
import {PathSegment} from '@sanity/types'
import {PortableTextBlock, PortableTextChild} from '../types/portableText'

type Partial<T> = {
  [P in keyof T]?: T[P]
}

function keepObjectEquality(object, keyMap) {
  const value = keyMap[object._key]
  if (value && isEqual(object, value)) {
    return value
  }
  keyMap[object._key] = object
  return object
}

export function toSlateValue(
  value: PortableTextBlock[] | undefined,
  textBlockType: string,
  keyMap: {} = {}
): Node[] {
  if (value && Array.isArray(value)) {
    return value.map(block => {
      const {_type, _key, ...rest} = block
      const isPortableText = block && block._type === textBlockType
      if (isPortableText) {
        let hasInlines = false
        const children = block.children.map(child => {
          const {_type, _key, ...rest} = child
          if (_type !== 'span') {
            hasInlines = true
            return keepObjectEquality(
              {_type, _key, children: [{text: ''}], value: rest, __inline: true},
              keyMap
            )
          } else {
            // Original object
            return child
          }
        })
        if (!hasInlines && Element.isElement(block)) {
          // Original object
          return block
        }
        return keepObjectEquality({_type, _key, ...rest, children}, keyMap)
      }
      return keepObjectEquality({_type, _key, children: [{text: ''}], value: rest}, keyMap)
    })
  }
  return []
}

export function fromSlateValue(
  value: (Node | Partial<Node>)[],
  textBlockType: string,
  keyMap: {} = {}
): PortableTextBlock[] {
  if (value && Array.isArray(value)) {
    return value.map(block => {
      const isPortableText = block && block._type === textBlockType
      if (isPortableText && Element.isElement(block)) {
        let hasInlines = false
        const children = block.children.map(child => {
          const {_type} = child
          if (_type !== 'span' && typeof child.value === 'object') {
            hasInlines = true
            const {value, children, __inline, ...rest} = child
            return keepObjectEquality({...rest, ...value}, keyMap) as PortableTextChild
          } else {
            return child as PortableTextChild
          }
        })
        if (typeof block._key === 'string' && typeof block._type === 'string') {
          if (!hasInlines) {
            // Original object
            return (block as unknown) as PortableTextBlock
          }
          return keepObjectEquality(
            {_key: block._key, _type: block._type, ...block, children},
            keyMap
          ) as PortableTextBlock
        }
        throw new Error('Not a valid block type')
      }
      const {_key, _type} = block
      const value = block.value as PortableTextBlock
      return keepObjectEquality(
        {_key, _type, ...(typeof value === 'object' ? value : {})},
        keyMap
      ) as PortableTextBlock
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
  children: (Node | Partial<Node>)[]
): [Element | undefined, number | undefined] {
  let blockIndex = -1
  const isNumber = Number.isInteger(Number(firstPathSegment))
  if (isNumber) {
    blockIndex = Number(firstPathSegment)
  } else if (children) {
    blockIndex = children.findIndex(blk => isEqual({_key: blk._key}, firstPathSegment))
  }
  if (blockIndex > -1) {
    return [children[blockIndex] as Element, blockIndex]
  }
  return [undefined, -1]
}

export function findChildAndIndexFromPath(
  secondPathSegment: PathSegment,
  block: Element
): [Element | Text | undefined, number] {
  let childIndex = -1
  const isNumber = Number.isInteger(Number(secondPathSegment))
  if (isNumber) {
    childIndex = Number(secondPathSegment)
  } else {
    childIndex = block.children.findIndex(child => isEqual({_key: child._key}, secondPathSegment))
  }
  if (childIndex > -1) {
    return [block.children[childIndex] as Element | Text, childIndex]
  }
  return [undefined, -1]
}
