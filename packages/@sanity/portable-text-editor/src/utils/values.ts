import {isEqual} from 'lodash'
import {Node, Element} from 'slate'
import {PathSegment} from '@sanity/types'
import {
  PortableTextBlock,
  PortableTextChild,
  PortableTextFeatures,
  TextBlock,
} from '../types/portableText'

type Partial<T> = {
  [P in keyof T]?: T[P]
}

function keepObjectEquality(
  object: PortableTextBlock,
  keyMap: Record<string, unknown>
): PortableTextBlock {
  const value = keyMap[object._key] as PortableTextBlock
  if (value && isEqual(object, value)) {
    return value
  }
  keyMap[object._key] = object
  return object
}

export function toSlateValue(
  value: PortableTextBlock[] | undefined,
  textBlockType: string,
  keyMap: Record<string, unknown> = {}
): PortableTextBlock[] {
  if (value && Array.isArray(value)) {
    return value.map((block) => {
      const {_type, _key, ...rest} = block
      const isPortableText = block._type === textBlockType
      if (isPortableText) {
        let hasInlines = false
        const blk = block as TextBlock
        const children = blk.children.map((child) => {
          const {_type: _t, _key: _k, ..._rest} = child
          if (_type !== 'span') {
            hasInlines = true
            return keepObjectEquality(
              {_type: _t, _key: _k, children: [{text: ''}], value: _rest, __inline: true},
              keyMap
            )
          }
          // Original object
          return child
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
  keyMap: Record<string, unknown> = {}
): PortableTextBlock[] {
  if (value && Array.isArray(value)) {
    return value.map((block) => {
      const isPortableText = block && block._type === textBlockType
      if (isPortableText && Element.isElement(block)) {
        let hasInlines = false
        const children = block.children.map((child) => {
          const {_type} = child
          if (
            _type !== 'span' &&
            typeof child.value === 'object' &&
            typeof child._type === 'string' &&
            typeof child._key === 'string'
          ) {
            hasInlines = true
            const {value: _v, _key: _k, _type: _t, children: _children, __inline, ...rest} = child
            return keepObjectEquality({_key: _k, _type: _t, ...rest, ..._v}, keyMap)
          }
          return child as PortableTextChild
        })
        if (typeof block._key === 'string' && typeof block._type === 'string') {
          if (!hasInlines) {
            // Original object
            return (block as unknown) as PortableTextBlock
          }
          return keepObjectEquality(
            {_key: block._key, _type: block._type, ...block, children},
            keyMap
          )
        }
      }
      const {_key, _type} = block
      const val = block.value as PortableTextBlock | undefined
      if (typeof _key === 'string' && typeof _type === 'string') {
        return keepObjectEquality({_key, _type, ...(typeof val === 'object' ? val : {})}, keyMap)
      }
      throw new Error('Not a valid block type')
    })
  }
  return value
}

export function isEqualToEmptyEditor(
  children: (Node | Partial<Node>)[] | undefined,
  portableTextFeatures: PortableTextFeatures
): boolean {
  return (
    children === undefined ||
    (!!children && Array.isArray(children) && children.length === 0) ||
    (!!children &&
      Array.isArray(children) &&
      children.length === 1 &&
      children[0]._type === portableTextFeatures.types.block.name &&
      !!children[0].children &&
      Array.isArray(children[0].children) &&
      children[0]?.children.length === 1 &&
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
    blockIndex = children.findIndex((blk) => isEqual({_key: blk._key}, firstPathSegment))
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
    childIndex = block.children.findIndex((child) => isEqual({_key: child._key}, secondPathSegment))
  }
  if (childIndex > -1) {
    return [block.children[childIndex] as Element | Text, childIndex]
  }
  return [undefined, -1]
}
