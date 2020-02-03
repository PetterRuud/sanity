import {set, insert, unset} from '../PatchEvent'
import {EditorOperation} from '../types/editor'
import {Patch} from '../types/patch'
import {Editor} from 'slate'
import {PortableTextFeatures, PortableTextBlock} from 'src/types/portableText'

export function createOperationToPatches(portableTextFeatures: PortableTextFeatures) {
  function insertTextPatch(editor: Editor, operation: EditorOperation) {
    const block = editor.children[operation.path[0]]
    const child = block && block.children[operation.path[1]]
    if (child) {
      const path = [{_key: block._key}, 'children', {_key: child._key}, 'text']
      return [set(child.text, path)]
    }
    return []
  }

  function removeTextPatch(
    _: Editor,
    operation: EditorOperation,
    beforeValue: PortableTextBlock[]
  ) {
    const block = beforeValue[operation.path[0]]
    const child = block && block.children[operation.path[1]]
    const patches: Patch[] = []
    if (child) {
      const path = [{_key: block._key}, 'children', {_key: child._key}, 'text']
      const newText = child.text
        ? `${child.text.substring(0, operation.offset)}${child.text.substring(
            operation.offset + operation.text.length
          )}`
        : ''
      patches.push(set(newText, path))
    }
    return patches
  }

  function setNodePatch(editor: Editor, operation: EditorOperation) {
    if (operation.path.length === 1) {
      return [set(operation.properties, [{_key: editor.children[operation.path[0]]._key}])]
    } else if (operation.path.length === 2) {
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

  function insertNodePatch(editor: Editor, operation: EditorOperation, beforeValue: PortableTextBlock[]) {
    const block = beforeValue[operation.path[0]]
    if (operation.path.length === 1 && block && block._key) {
      const position = operation.path[0] === 0 ? 'before' : 'after'
      const targetKey = operation.path[0] === 0 ? block._key : beforeValue[operation.path[0] - 1]._key
      if (targetKey) {
        return [insert(operation.node, position, [{_key: targetKey}])]
      }
      throw new Error('Target key not found!')
    } else if (
      operation.path.length === 2 &&
      editor.children[operation.path[0]] &&
      editor.children[operation.path[0]]._type === portableTextFeatures.types.block.name
    ) {
      const position = block.children.length === 0 || !block.children[operation.path[1] - 1] ? 'before' : 'after'
      return [
        insert(operation.node, position, [
          {_key: block._key},
          'children',
          block.children.length <= 1 || !block.children[operation.path[1] - 1] ? 0 : {_key: block.children[operation.path[1] - 1]._key}
        ])
      ]
    } else {
      // TODO: figure out how to insert something in a block type we don't know the structure of
      throw new Error('This must be figured out!')
    }
  }

  function splitNodePatch(
    editor: Editor,
    operation: EditorOperation,
    beforeValue: PortableTextBlock[]
  ) {
    const patches: Patch[] = []
    const splitBlock = editor.children[operation.path[0]]
    if (!splitBlock) {
      throw new Error(`Block with path ${JSON.stringify(operation.path[0])} could not be found`)
    }
    if (operation.path.length === 1) {
      const oldBlock = beforeValue[operation.path[0]]
      if (oldBlock && oldBlock._key) {
        const spansToMove = beforeValue[operation.path[0]].children.slice(operation.position)
        spansToMove.forEach(span => {
          const path = [{_key: oldBlock._key}, 'children', {_key: span._key}]
          patches.push(unset(path))
        })
        const targetValue = editor.children[operation.path[0] + 1]
        patches.push(insert([targetValue], 'after', [{_key: splitBlock._key}]))
      }
      return patches
    }
    if (operation.path.length === 2) {
      const splitSpan = editor.children[operation.path[0]].children[operation.path[1]]
      const targetSpans = editor.children[operation.path[0]].children.slice(
        operation.path[1] + 1,
        operation.path[1] + 2
      )
      patches.push(
        set(splitSpan.text, [{_key: splitBlock._key}, 'children', {_key: splitSpan._key}, 'text'])
      )
      patches.push(
        insert(targetSpans, 'after', [
          {_key: splitBlock._key},
          'children',
          {_key: editor.children[operation.path[0]].children[operation.path[1]]._key}
        ])
      )
      return patches
    }
    return patches
  }

  function removeNodePatch(
    _: Editor,
    operation: EditorOperation,
    beforeValue: PortableTextBlock[]
  ) {
    if (operation.path.length === 1) {
      const targetKey = beforeValue[operation.path[0]]._key
      // Remove a single block
      if (targetKey) {
        return [unset([{_key: targetKey}])]
      }
      throw new Error('Target key not found!')
    } else if (operation.path.length === 2) {
      const block = beforeValue[operation.path[0]]
      const spanToRemove = block.children[operation.path[1]]
      return [unset([{_key: block._key}, 'children', {_key: spanToRemove._key}])]
    } else {
      console.error('UNHANDLED OPERATION:', JSON.stringify(operation, null, 2))
      throw new Error('This must be figured out!')
    }
  }

  function mergeNodePatch(editor: Editor, operation: EditorOperation, beforeValue: PortableTextBlock[]) {
    const patches: Patch[] = []
    if (operation.path.length === 1) {
      const targetKey = beforeValue[operation.path[0]]._key
      if (targetKey) {
        patches.push(unset([{_key: targetKey}]))
        patches.push(
          set(editor.children[operation.path[0] - 1], [
            {_key: editor.children[operation.path[0] - 1]._key}
          ])
        )
      } else {
        throw new Error('Targetkey not found!')
      }
    } else if (operation.path.length === 2) {
      // TODO: maybe make this more atomic
      patches.push(
        set(editor.children[operation.path[0]], [
          {_key: editor.children[operation.path[0]]._key}
        ])
      )
    }
    return patches
  }
  return {
    insertNodePatch,
    insertTextPatch,
    mergeNodePatch,
    removeNodePatch,
    removeTextPatch,
    setNodePatch,
    splitNodePatch
  }
}
