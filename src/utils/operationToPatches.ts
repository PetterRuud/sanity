import {set, insert, unset, diffMatchPatch, setIfMissing} from '../patch/PatchEvent'
import {EditorOperation} from '../types/editor'
import {Patch} from '../types/patch'
import {Editor} from 'slate'
import {omitBy, isUndefined} from 'lodash'
import {PortableTextFeatures, PortableTextBlock} from '../types/portableText'
import {fromSlateValue} from './values'

function findBlock(path, value: PortableTextBlock[] | undefined) {
  if (path[0] && path[0]._key) {
    return value?.find(blk => blk._key === path[0]._key)
  }
  if (Number.isInteger(path[0])) {
    return value && value[path[0]]
  }
  throw new Error('Invalid first path segment')
}

// TODO: these functions should be cleaned up when the editor is actually working (use helpers like findBlock above)

export function createOperationToPatches(portableTextFeatures: PortableTextFeatures) {
  function insertTextPatch(
    editor: Editor,
    operation: EditorOperation,
    beforeValue: PortableTextBlock[]
  ) {
    const block = editor && editor.children[operation.path[0]]
    if (!block) {
      throw new Error('Could not find block')
    }
    const child = block && block.children && block.children[operation.path[1]]
    if (!child) {
      throw new Error('Could not find child')
    }
    const path = [{_key: block._key}, 'children', {_key: child._key}, 'text']
    const prevBlock = findBlock(operation.path, beforeValue)
    const prevText =
      prevBlock &&
      prevBlock.children &&
      prevBlock.children[operation.path[1]] &&
      prevBlock.children[operation.path[1]].text
    return [diffMatchPatch(prevText || '', child.text, path)]
  }

  function removeTextPatch(
    editor: Editor,
    operation: EditorOperation,
    beforeValue: PortableTextBlock[]
  ) {
    const block = editor && editor.children[operation.path[0]]
    if (!block) {
      throw new Error('Could not find block')
    }
    const child = block && block.children && block.children[operation.path[1]]
    if (!child) {
      throw new Error('Could not find child')
    }
    const path = [{_key: block._key}, 'children', {_key: child._key}, 'text']
    const prevText =
      beforeValue[operation.path[0]] &&
      beforeValue[operation.path[0]].children &&
      beforeValue[operation.path[0]].children[operation.path[1]] &&
      beforeValue[operation.path[0]].children[operation.path[1]].text
    return [diffMatchPatch(prevText || '', child.text, path)]
  }

  function setNodePatch(editor: Editor, operation: EditorOperation) {
    if (operation.path.length === 1) {
      const setNode = omitBy(
        {...editor.children[operation.path[0]], ...operation.newProperties},
        isUndefined
      )
      return [
        set(fromSlateValue([setNode], portableTextFeatures.types.block.name)[0], [
          {_key: editor.children[operation.path[0]]._key}
        ])
      ]
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
      throw new Error(`Unexpected path encountered: ${JSON.stringify(operation.path)}`)
    }
  }

  function insertNodePatch(
    editor: Editor,
    operation: EditorOperation,
    beforeValue: PortableTextBlock[]
  ) {
    const block = beforeValue[operation.path[0]]
    const isTextBlock =
      editor.children[operation.path[0]]._type === portableTextFeatures.types.block.name
    if (operation.path.length === 1) {
      const position = operation.path[0] === 0 ? 'before' : 'after'
      const targetKey =
        operation.path[0] === 0
          ? block && block._key
          : beforeValue[operation.path[0] - 1] && beforeValue[operation.path[0] - 1]._key
      if (targetKey) {
        return [
          insert(
            [fromSlateValue([operation.node], portableTextFeatures.types.block.name)[0]],
            position,
            [{_key: targetKey}]
          )
        ]
      }
      if (beforeValue.length === 0) {
        return [
          setIfMissing(beforeValue, []),
          insert(
            [fromSlateValue([operation.node], portableTextFeatures.types.block.name)[0]],
            'before',
            [operation.path[0]]
          )
        ]
      }
      throw new Error('Target key not found!')
    } else if (operation.path.length === 2 && editor.children[operation.path[0]] && isTextBlock) {
      const position =
        block.children.length === 0 || !block.children[operation.path[1] - 1] ? 'before' : 'after'
      return [
        insert([operation.node], position, [
          {_key: block._key},
          'children',
          block.children.length <= 1 || !block.children[operation.path[1] - 1]
            ? 0
            : {_key: block.children[operation.path[1] - 1]._key}
        ])
      ]
    } else {
      throw new Error(
        `Unexpected path encountered: ${JSON.stringify(operation.path)} - ${JSON.stringify(
          beforeValue
        )}`
      )
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
        const targetValue = editor.children[operation.path[0] + 1]
        if (targetValue) {
          const spansToMove = beforeValue[operation.path[0]].children.slice(operation.position)
          spansToMove.forEach(span => {
            const path = [{_key: oldBlock._key}, 'children', {_key: span._key}]
            patches.push(unset(path))
          })
          patches.push(insert([targetValue], 'after', [{_key: splitBlock._key}]))
        }
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
    const block = beforeValue[operation.path[0]]
    if (operation.path.length === 1) {
      // Remove a single block
      if (block && block._key) {
        return [unset([{_key: block._key}])]
      }
      throw new Error('Block not found')
    } else if (operation.path.length === 2) {
      const spanToRemove = block && block.children && block.children[operation.path[1]]
      if (spanToRemove) {
        return [unset([{_key: block._key}, 'children', {_key: spanToRemove._key}])]
      }
      // TODO: remove this console if confirmed ok
      console.warn('Span not found, maybe ok?')
      // If it was not there before, do nothing
      return []
    } else {
      throw new Error(`Unexpected path encountered: ${JSON.stringify(operation.path)}`)
    }
  }

  function mergeNodePatch(
    editor: Editor,
    operation: EditorOperation,
    beforeValue: PortableTextBlock[]
  ) {
    const patches: Patch[] = []
    if (operation.path.length === 1) {
      const block = beforeValue[operation.path[0]]
      const targetKey = block && block._key
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
      // TODO: maybe make this more atomic instead of setting the whole block
      patches.push(
        set(editor.children[operation.path[0]], [{_key: editor.children[operation.path[0]]._key}])
      )
    } else {
      throw new Error(`Unexpected path encountered: ${JSON.stringify(operation.path)}`)
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
