import {isObject} from 'lodash'
import {set, unset, insert} from '../patch/PatchEvent'
import {PortableTextBlock, PortableTextFeatures} from '../types/portableText'
import {InvalidValueResolution} from '../types/editor'

export function validateValue(
  value: PortableTextBlock[] | undefined,
  portableTextFeatures: PortableTextFeatures,
  keyGenerator: () => string
): {valid: boolean; resolution: InvalidValueResolution} {
  let resolution: InvalidValueResolution = null
  let valid = true
  const validChildTypes = [
    ...[portableTextFeatures.types.span.name],
    ...portableTextFeatures.types.inlineObjects.map(t => t.name)
  ]
  const validBlockTypes = [
    ...[portableTextFeatures.types.block.name],
    ...portableTextFeatures.types.blockObjects.map(t => t.name)
  ]

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
        action: 'Unset the value',
        item: value
      }
    }
  }
  if (
    value.some((blk: PortableTextBlock, index: number): boolean => {
      if (!isObject(blk)) {
        resolution = {
          patches: [unset([index])],
          description: `Block must be an object, got ${String(blk)}`,
          action: `Unset invalid item`,
          item: blk
        }
        return true
      }
      // Test that every block has a _key
      if (!blk._key) {
        resolution = {
          patches: [set({...blk, _key: keyGenerator()}, [index])],
          description: `Block at index ${index} is missing required _key.`,
          action: 'Set the block with a random _key value',
          item: blk
        }
        return true
      }
      // Test that every block has valid _type
      if (!blk._type || validBlockTypes.includes(blk._type) === false) {
        resolution = {
          patches: [unset([{_key: blk._key}])],
          description: `Block with _key '${blk._key}' has invalid _type '${blk._type}'`,
          action: 'Remove the block',
          item: blk
        }
        return true
      }
      // Test that every child in text block is valid
      if (blk._type === portableTextFeatures.types.block.name) {
        // Test that it has children
        if (!blk.children) {
          resolution = {
            patches: [unset([{_key: blk._key}])],
            description: `Text block with _key '${blk._key}' is missing required key 'children'.`,
            action: 'Remove the block',
            item: blk
          }
          return true
        }
        // Test that children is lengthy
        if (blk.children && blk.children.length === 0) {
          const newSpan = {
            _type: portableTextFeatures.types.span.name,
            _key: keyGenerator(),
            text: ''
          }
          resolution = {
            patches: [insert([newSpan], 'after', [{_key: blk._key}, 'children', 0])],
            description: `Children for text block with _key '${blk._key}' is empty.`,
            action: 'Insert an empty text',
            item: blk
          }
          return true
        }
        // Test very child
        if (
          blk.children.some((child, cIndex) => {
            if (!child._key) {
              const newchild = {...child, _key: keyGenerator()}
              resolution = {
                patches: [set(newchild, [{_key: blk._key}, 'children', cIndex])],
                description: `Child at index ${cIndex} is missing required _key in block with _key ${blk._key}.`,
                action: 'Set a new random _key on the object',
                item: blk
              }
              return true
            }
            // Verify that childs have valid types
            if (!child._type || validChildTypes.includes(child._type) === false) {
              resolution = {
                patches: [unset([{_key: blk._key}, 'children', {_key: child._key}])],
                description: `Child with _key '${child._key}' in block with key '${blk._key}' has invalid '_type' property (${child._type}).`,
                action: 'Remove the object',
                item: blk
              }
              return true
            }
            // Verify that spans have .text
            if (child._type === portableTextFeatures.types.span.name && child.text === undefined) {
              resolution = {
                patches: [
                  set({...child, text: ''}, [{_key: blk._key}, 'children', {_key: child._key}])
                ],
                description: `Child with _key '${child._key}' in block with key '${blk._key}' is missing text property!`,
                action: `Write an empty .text to the object`,
                item: blk
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
