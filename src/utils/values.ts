import {isObject} from 'lodash'
import {Node} from 'slate'
import {PortableTextBlock} from '../types/portableText'

type Partial<T> = {
  [P in keyof T]?: T[P]
}

export function toSlateValue(value: PortableTextBlock[] | undefined | Node, textBlockType: string) {
  if (value && Array.isArray(value)) {
    return value
      .map(blk => {
        if (!isObject(blk)) {
          return null
        }
        const isPortableText = blk && blk._type === textBlockType
        if (isPortableText) {
          return blk
        }
        const {_type, _key, ...rest} = blk
        return {_type, _key, children: [{text: ''}], value: rest}
      })
      .filter(Boolean)
  }
  return value
}

export function fromSlateValue(
  value: (Node | Partial<Node>)[],
  textBlockType: string
): PortableTextBlock[] {
  if (value && Array.isArray(value)) {
    return value.map(blk => {
      const isPortableText = blk && blk._type === textBlockType
      if (isPortableText) {
        return blk
      }
      const {_key, _type} = blk
      return {_key, _type, ...blk.value}
    })
  }
  return value
}
