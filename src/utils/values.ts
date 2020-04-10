import {Node} from 'slate'
import {PortableTextBlock} from '../types/portableText'

type Partial<T> = {
  [P in keyof T]?: T[P]
}

export function toSlateValue(
  value: PortableTextBlock[] | undefined,
  textBlockType: string
): Node[] {
  if (value && Array.isArray(value)) {
    return value
      .map((blk: PortableTextBlock) => {
        const {_type, _key, ...rest} = blk
        const isPortableText = blk && blk._type === textBlockType
        if (isPortableText) {
          return {_type, _key, children: blk.children, ...rest}
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

export function isEqualToEmptyEditor(children, portableTextFeatures) {
  return (
    children === undefined ||
    children && Array.isArray(children) && children.length === 0 ||
    children &&
    Array.isArray(children) &&
    (children.length === 1 &&
      children[0]._type === portableTextFeatures.types.block.name &&
      children[0].children &&
      children[0].children.length === 1 &&
      children[0].children[0]._type === 'span' &&
      children[0].children[0].text === '')
  )

}