import {set, unset, insert} from '../patch/PatchEvent'
import {isObject} from 'lodash'
import {PortableTextBlock, PortableTextFeatures} from '../types/portableText'
import {InvalidValueResolution} from '../types/editor'

export function validateValue(
  value: PortableTextBlock[] | undefined,
  portableTextFeatures: PortableTextFeatures,
  keyGenerator: () => string
): {valid: boolean; resolution: InvalidValueResolution} {
  let resolution: InvalidValueResolution = null
  // Undefined is allowed
  if (value === undefined) {
    return {valid: true, resolution: null}
  }
  // Only lengthy arrays are allowed
  if (!Array.isArray(value) || value.length === 0) {
    return {
      valid: false,
      resolution: {
        patches: [unset([])],
        description: 'Value must be an array or undefined',
        action: 'Unset the value'
      }
    }
  }
  let valid = true
  if (
    value.some((blk: PortableTextBlock, index: number): boolean => {
      if (!isObject(blk)) {
        resolution = {
          patches: [unset([index])],
          description: `Block must be an object, got ${String(blk)}`,
          action: `Unset ${String(blk)}`
        }
        return true
      }
      // Test that every block has a _key and _type
      if (!blk._key) {
        const newBlk = {...blk, _key: keyGenerator()}
        resolution = {
          patches: [set(newBlk, [index])],
          description: `Block at index ${index} is missing required _key.`,
          action: 'Set the block with a fresh _key'
        }
        return true
      }
      if (!blk._type) {
        resolution = {
          patches: [unset([{_key: blk._key}])],
          description: `Block with _key '${blk._key}' is missing required key '_type'.`,
          action: 'Remove the block'
        }
        return true
      }
      // Test that every child in text block is valid
      if (blk._type === portableTextFeatures.types.block.name) {
        if (!blk.children) {
          resolution = {
            patches: [unset([{_key: blk._key}])],
            description: `Text block with _key '${blk._key}' is missing required key 'children'.`,
            action: 'Remove the block'
          }
          return true
        }
        if (blk.children && blk.children.length === 0) {
          const newSpan = {
            _type: portableTextFeatures.types.span.name,
            _key: keyGenerator(),
            text: ''
          }
          resolution = {
            patches: [insert([newSpan], 'after', [{_key: blk._key}, 'children', 0])],
            description: `Children for text block with _key '${blk._key}' is empty.`,
            action: 'Insert an empty span'
          }
          return true
        }
        if (
          blk.children.some((child, cIndex) => {
            if (!child._key) {
              const newchild = {...child, _key: keyGenerator()}
              resolution = {
                patches: [set(newchild, [{_key: blk._key}, 'children', cIndex])],
                description: `Child at index ${cIndex} is missing required _key in block with _key ${blk._key}.`,
                action: 'Set the child with a fresh _key'
              }
              return true
            }
            if (!child._type && blk._key) {
              resolution = {
                patches: [unset([{_key: blk._key}, 'children', {_key: child._key}])],
                description: `Child with _key '${child._key}' in block with key '${blk._key}' is missing required key '_type'.`,
                action: 'Remove the child'
              }
              return true
            }
            if (
              ![
                ...portableTextFeatures.types.inlineObjects.map(type => type.name),
                portableTextFeatures.types.span.name
              ].includes(child._type)
            ) {
              resolution = {
                patches: [unset([])],
                description: `Found unknown child _type ('${child._type}') for block with _key ${blk._key}`,
                action: 'Remove the child'
              }
              return true
            }
            return false
          })
        ) {
          valid = false
        }
      }
      return false
    })
  ) {
    valid = false
  }
  return {valid, resolution}
}
