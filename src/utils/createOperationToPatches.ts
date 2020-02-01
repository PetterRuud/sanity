import {set, insert, unset} from '../PatchEvent'
import {EditorOperation, EditorNode} from '../types/editor'
import {Patch} from '../types/patch'

export function createOperationToPatches() {
  function insertTextPatch(operation: EditorOperation, value: EditorNode[]) {
    return [set(operation.text, [...operation.path, 'text'])]
  }

  function setNodePatch(operation: EditorOperation, value: EditorNode[]) {
    const block = value[operation.path[0]]
    return [set(block, operation.path)]
  }

  function insertNodePatch(operation: EditorOperation, value: EditorNode[]) {
    const patches: Patch[] = []
    // patches.push(insert([newBlock], 'after', [{_key: splitBlock._key}]))
    return patches
  }

  function splitNodePatch(operation: EditorOperation, value: EditorNode[]) {
    const patches: Patch[] = []
    const splitBlock: EditorNode = value[operation.path[0]]
    if (operation.path.length === 1) {
      patches.push(set(splitBlock, [{_key: splitBlock._key}]))
      const newBlock = value[operation.path[0] + 1]
      patches.push(insert([newBlock], 'after', [{_key: splitBlock._key}]))
    }
    if (operation.path.size > 1) {
      patches.push(set(splitBlock, [{_key: splitBlock._key}]))
    }
    return patches
  }

  function removeNodePatch(operation: EditorOperation, value: EditorNode[]) {
    const patches: Patch[] = []
    const block = value[operation.path[0]]
    if (!block) {
      if (value.length === 0) {
        patches.push(unset([]))
      }  
      return patches
    }
    const isPlaceholder = !!(block && block.__placeHolderBlock)
    // Send unset patch unless is it is a placeholder
    if (operation.path.length === 1 && !isPlaceholder) {
      patches.push(unset([{_key: block._key}]))
    }
    if (operation.path.size > 1) {
      // Only relevant for portable text type blocks
      if (block && block._type !== 'block') {
        return patches
      }
      patches.push(set(block, [{_key: block._key}]))
    }
    return patches
  }

  return function operationToPatches(operation: EditorOperation, value: EditorNode[]): Patch[] {
    switch (operation.type) {
      case 'split_node':
        return splitNodePatch(operation, value)
      case 'insert_node':
        return insertNodePatch(operation, value)
      case 'insert_text':
        return insertTextPatch(operation, value)
      case 'set_node':
        return setNodePatch(operation, value)
      case 'remove_node':
        return removeNodePatch(operation, value)  
      default:
        return []
    }
  }
}
