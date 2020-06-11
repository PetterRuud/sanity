import {set, insert, unset, diffMatchPatch, setIfMissing} from '../patch/PatchEvent'
import {Patch} from '../types/patch'
import {Path} from '../types/path'
import {
  Editor,
  MoveNodeOperation,
  InsertTextOperation,
  RemoveTextOperation,
  SetNodeOperation,
  InsertNodeOperation,
  SplitNodeOperation,
  RemoveNodeOperation,
  MergeNodeOperation
} from 'slate'
import {omitBy, isUndefined} from 'lodash'
import {PortableTextFeatures, PortableTextBlock} from '../types/portableText'
import {fromSlateValue} from './values'
import {debugWithName} from './debug'

const debug = debugWithName('operationToPatches')

// TODO: optimize how nodes are found and make sure everything here uses those finders.

function findBlock(path, value: PortableTextBlock[] | undefined) {
  if (path[0] && path[0]._key) {
    return value?.find(blk => blk._key === path[0]._key)
  }
  if (Number.isInteger(path[0])) {
    return value && value[path[0]]
  }
  throw new Error('Invalid first path segment')
}

export function createOperationToPatches(portableTextFeatures: PortableTextFeatures) {
  function insertTextPatch(
    editor: Editor,
    operation: InsertTextOperation,
    beforeValue: PortableTextBlock[]
  ) {
    const block = editor && editor.children[operation.path[0]]
    if (!block) {
      throw new Error('Could not find block')
    }
    if (typeof block._key !== 'string') {
      throw new Error('Expected block to have a _key')
    }
    const child = block && Array.isArray(block.children) && block.children[operation.path[1]]
    if (!child) {
      throw new Error('Could not find child')
    }
    const path: Path = [{_key: block._key}, 'children', {_key: child._key}, 'text']
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
    operation: RemoveTextOperation,
    beforeValue: PortableTextBlock[]
  ) {
    const block = editor && editor.children[operation.path[0]]
    if (!block) {
      throw new Error('Could not find block')
    }
    if (typeof block._key !== 'string') {
      throw new Error('Expected block to have a _key')
    }
    const child = block && Array.isArray(block.children) && block.children[operation.path[1]]
    if (!child) {
      throw new Error('Could not find child')
    }
    const path: Path = [{_key: block._key}, 'children', {_key: child._key}, 'text']
    const prevText =
      beforeValue[operation.path[0]] &&
      beforeValue[operation.path[0]].children &&
      beforeValue[operation.path[0]].children[operation.path[1]] &&
      beforeValue[operation.path[0]].children[operation.path[1]].text
    return [diffMatchPatch(prevText || '', child.text, path)]
  }

  function setNodePatch(editor: Editor, operation: SetNodeOperation) {
    if (operation.path.length === 1) {
      const block = editor.children[operation.path[0]]
      if (typeof block._key !== 'string') {
        throw new Error('Expected block to have a _key')
      }
      const setNode = omitBy(
        {...editor.children[operation.path[0]], ...operation.newProperties},
        isUndefined
      )
      return [
        set(fromSlateValue([setNode], portableTextFeatures.types.block.name)[0], [
          {_key: block._key}
        ])
      ]
    } else if (operation.path.length === 2) {
      const block = editor.children[operation.path[0]]
      if (Editor.isBlock(editor, block) && typeof block._key === 'string') {
        const child = block.children[operation.path[1]]
        if (child && typeof child._key === 'string') {
          const blockKey = block._key
          const childKey = child._key
          const patches: Patch[] = []
          Object.keys(operation.newProperties).forEach(key => {
            patches.push(
              set(operation.newProperties[key], [
                {_key: blockKey},
                'children',
                {_key: childKey},
                key
              ])
            )
          })
          return patches
        }
        throw new Error('Could not find a valid child')
      }
      throw new Error('Could not find a valid block')
    } else {
      throw new Error(`Unexpected path encountered: ${JSON.stringify(operation.path)}`)
    }
  }

  function insertNodePatch(
    editor: Editor,
    operation: InsertNodeOperation,
    beforeValue: PortableTextBlock[]
  ) {
    const block = beforeValue[operation.path[0]]
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
    } else if (operation.path.length === 2 && editor.children[operation.path[0]]) {
      const position =
        block.children.length === 0 || !block.children[operation.path[1] - 1] ? 'before' : 'after'
      const child = fromSlateValue(
        [
          {
            _key: 'bogus',
            _type: portableTextFeatures.types.block.name,
            children: [
              {
                ...operation.node,
                _type: operation.node._type || portableTextFeatures.types.span.name
              }
            ]
          }
        ],
        portableTextFeatures.types.block.name
      )[0].children[0]
      return [
        insert([child], position, [
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
    operation: SplitNodeOperation,
    beforeValue: PortableTextBlock[]
  ) {
    const patches: Patch[] = []
    const splitBlock = editor.children[operation.path[0]]
    if (!Editor.isBlock(editor, splitBlock) || typeof splitBlock._key !== 'string') {
      throw new Error(`Block with path ${JSON.stringify(operation.path[0])} could not be found`)
    }
    if (operation.path.length === 1) {
      const oldBlock = beforeValue[operation.path[0]]
      if (oldBlock && oldBlock._key) {
        const targetValue = editor.children[operation.path[0] + 1]
        if (targetValue) {
          patches.push(insert([targetValue], 'after', [{_key: splitBlock._key}]))
          const spansToUnset = beforeValue[operation.path[0]].children.slice(operation.position)
          spansToUnset.forEach(span => {
            const path = [{_key: oldBlock._key}, 'children', {_key: span._key}]
            patches.push(unset(path))
          })
        }
      }
      return patches
    }
    if (operation.path.length === 2) {
      const splitSpan = splitBlock.children[operation.path[1]]
      if (typeof splitSpan._key !== 'string') {
        throw new Error('Span is missing _key')
      }
      const targetSpans = splitBlock.children.slice(operation.path[1] + 1, operation.path[1] + 2)
      patches.push(
        insert(targetSpans, 'after', [{_key: splitBlock._key}, 'children', {_key: splitSpan._key}])
      )
      patches.push(
        set(splitSpan.text, [{_key: splitBlock._key}, 'children', {_key: splitSpan._key}, 'text'])
      )
      return patches
    }
    return patches
  }

  function removeNodePatch(
    _: Editor,
    operation: RemoveNodeOperation,
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
      // If it was not there before, do nothing
      debug('Span not found in editor trying to remove node')
      return []
    } else {
      throw new Error(`Unexpected path encountered: ${JSON.stringify(operation.path)}`)
    }
  }

  function mergeNodePatch(
    editor: Editor,
    operation: MergeNodeOperation,
    beforeValue: PortableTextBlock[]
  ) {
    const patches: Patch[] = []
    if (operation.path.length === 1) {
      const block = beforeValue[operation.path[0]]
      const targetKey = block && block._key
      if (targetKey) {
        const newBlock = fromSlateValue(
          [editor.children[operation.path[0] - 1]],
          portableTextFeatures.types.block.name
        )[0]
        patches.push(set(newBlock, [{_key: newBlock._key}]))
        patches.push(unset([{_key: targetKey}]))
      } else {
        throw new Error('Targetkey not found!')
      }
    } else if (operation.path.length === 2) {
      const block = beforeValue[operation.path[0]]
      const mergedSpan = block.children[operation.path[1]]
      const targetBlock = editor.children[operation.path[0]]
      if (!Editor.isBlock(editor, targetBlock)) {
        throw new Error('Block expected')
      }
      if (typeof targetBlock._key !== 'string') {
        throw new Error('Expected block to have a _key')
      }
      const targetSpan = targetBlock.children[operation.path[1] - 1]
      if (typeof targetSpan._key !== 'string') {
        throw new Error('Expected span to have a _key')
      }
      // Set the merged span with it's new value
      patches.push(
        set(targetSpan.text, [{_key: block._key}, 'children', {_key: targetSpan._key}, 'text'])
      )
      patches.push(unset([{_key: block._key}, 'children', {_key: mergedSpan._key}]))
    } else {
      throw new Error(`Unexpected path encountered: ${JSON.stringify(operation.path)}`)
    }
    return patches
  }

  function moveNodePatch(
    editor: Editor,
    operation: MoveNodeOperation,
    beforeValue: PortableTextBlock[]
  ) {
    // TODO: implement this if we need to use wrapNodes/unwrapNodes transformations.
    // So far it's not needed 2020-05-10
    throw new Error('Not implemented')
  }

  return {
    insertNodePatch,
    insertTextPatch,
    mergeNodePatch,
    moveNodePatch,
    removeNodePatch,
    removeTextPatch,
    setNodePatch,
    splitNodePatch
  }
}
