import {set, insert, unset, setIfMissing} from '../PatchEvent'
import {EditorOperation} from '../types/editor'
import {Patch} from '../types/patch'
import {Editor} from 'slate'
import {PortableTextFeatures, PortableTextBlock} from 'src/types/portableText'

export function createOperationToPatches(
  portableTextFeatures: PortableTextFeatures,
  keyGenerator: () => string
) {
  function insertTextPatch(editor: Editor, operation: EditorOperation) {
    const block = editor.children[operation.path[0]]
    const child = block && editor.children[operation.path[0]].children[operation.path[1]]
    const patches: Patch[] = []
    if (child) {
      const path = [{_key: block._key}, 'children', {_key: child._key}, 'text']
      if (
        editor.children.length === 1 &&
        block.children.length === 1 &&
        block.children[0].text.length < 2
      ) {
        patches.push(setIfMissing([block], []))
      }
      patches.push(set(child.text, path))
    }
    return patches
  }

  function removeTextPatch(editor: Editor, operation: EditorOperation) {
    // Basicly the same as insertTextPatch, as we just set the span text
    return insertTextPatch(editor, operation)
  }

  function setNodePatch(
    editor: Editor,
    operation: EditorOperation
  ) {
    if (operation.path.length === 1) {
      return [set(operation.properties, [{_key: editor.children[operation.path[0]]._key}])]
    } else if (
      operation.path.length === 2 &&
      editor.children[operation.path[0]] &&
      editor.children[operation.path[0]]._type === portableTextFeatures.types.block.name &&
      editor.children[operation.path[0]].children[operation.path[1]]
    ) {
      const child = editor.children[operation.path[0]].children[operation.path[1]]
      return [
        set({...child, ...operation.newProperties}, [
          {_key: editor.children[operation.path[0]]._key},
          'children',
          {_key: child._key}
        ])
      ]
    } else {
      // Set the whole block
      const block = editor.children[operation.path[0]]
      return [set(block, [{_key: editor.children[operation.path[0]]._key}])]
    }
  }

  function insertNodePatch(editor: Editor, operation: EditorOperation) {
    const block = editor.children[operation.path[0]]
    if (operation.path.length === 1) {
      return [insert(operation.node, 'after', [{_key: block._key}])]
    } else if (
      operation.path.length === 2 &&
      editor.children[operation.path[0]] &&
      editor.children[operation.path[0]]._type === portableTextFeatures.types.block.name
    ) {
      return [
        insert(operation.node, 'after', [
          {_key: block._key},
          'children',
          block.children.length <= 1 ? 0 : {_key: block.children[operation.path[1] - 1]._key}
        ])
      ]
    } else {
      // TODO: figure out how to insert something in a block type we don't know the structure of
      throw new Error('This must be figured out!')
    }
  }

  function splitNodePatch(editor: Editor, operation: EditorOperation) {
    const patches: Patch[] = []
    const splitBlock = editor.children[operation.path[0]]
    // Return if this is not a portable text block
    if (splitBlock._type !== portableTextFeatures.types.block.name) {
      return patches
    }
    const targetBlock = editor.children[operation.path[0] + 1]
    if (operation.path.length === 1) {
      // We don't care about this one, because it's all taken care of below
      return patches
    } else if (operation.path.length === 2) {
      patches.push(set(splitBlock, [{_key: splitBlock._key}]))
      patches.push(insert([targetBlock], 'after', [{_key: splitBlock._key}]))
    }
    return patches
  }

  function removeNodePatch(editor: Editor, operation: EditorOperation, propsValue: PortableTextBlock[] | undefined) {
    if (editor.children.length === 0) {
      return [unset([])]
    }
    const {node} = operation
    if (operation.path.length === 1) {
      // Remove a single block
      return [unset([{_key: node._key}])]
    } else if (
      operation.path.length === 2 &&
      [portableTextFeatures.types.block.name, 'span'].includes(operation.node._type) &&
      propsValue
    ) {
      // Remove block child
      return [
        unset([
          {_key: propsValue[operation.path[0]]._key}, // TODO: this could be gone!
          'children',
          {_key: operation.node._key}
        ])
      ]
    } else {
      // TODO: figure out how to remove something we don't know the structure of
      console.error('UNHANDLED OPERATION:', JSON.stringify(operation, null, 2))
      throw new Error('This must be figured out!')
    }
  }

  function mergeNodePatch(editor: Editor, operation: EditorOperation) {
    const patches: Patch[] = []
    if (operation.path.length === 1) {
      patches.push(unset([{_key: operation.properties._key}]))
      patches.push(
        set(editor.children[operation.path[0] - 1], [
          {_key: editor.children[operation.path[0] - 1]._key}
        ])
      )
    }
    return patches
  }

  return function operationToPatches(
    editor: Editor,
    operation: EditorOperation,
    propsValue: PortableTextBlock[] | undefined // Needed to find keys of deleted nodes
  ): Patch[] {
    // console.log(JSON.stringify(operation))
    // console.log(JSON.stringify(editor.children))
    switch (operation.type) {
      case 'insert_text':
        return insertTextPatch(editor, operation)
      case 'remove_text':
        return removeTextPatch(editor, operation)
      case 'remove_node':
        return removeNodePatch(editor, operation, propsValue)
      case 'split_node':
        return splitNodePatch(editor, operation)
      case 'insert_node':
        return insertNodePatch(editor, operation)
      case 'set_node':
        return setNodePatch(editor, operation)
      case 'merge_node':
        return mergeNodePatch(editor, operation)
      default:
        // console.error(`${operation.type} is not implemented!`, operation)
        return []
    }
  }
}
