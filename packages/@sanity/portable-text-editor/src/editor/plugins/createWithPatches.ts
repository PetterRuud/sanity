import * as DMP from 'diff-match-patch'
import {debounce, isEqual} from 'lodash'
import {Subject} from 'rxjs'
import {Editor, Operation, Transforms, Path, Node, Range} from 'slate'
import {setIfMissing, unset} from '../../patch/PatchEvent'
import {Patch} from '../../types/patch'

import {
  fromSlateValue,
  isEqualToEmptyEditor,
  findBlockAndIndexFromPath,
  findChildAndIndexFromPath,
} from '../../utils/values'
import {PortableTextFeatures} from '../../types/portableText'
import {EditorChange, PatchObservable, PortableTextSlateEditor} from '../../types/editor'
import {debugWithName} from '../../utils/debug'
import {createPatchToOperations} from '../../utils/patchToOperations'
import {PATCHING, withoutPatching, isPatching} from '../../utils/withoutPatching'
import {KEY_TO_VALUE_ELEMENT} from '../../utils/weakMaps'

const debug = debugWithName('plugin:withPatches')

const dmp = new DMP.diff_match_patch()

const THROTTLE_EDITOR_MS = 500

export function createWithPatches(
  {
    insertNodePatch,
    insertTextPatch,
    mergeNodePatch,
    moveNodePatch,
    removeNodePatch,
    removeTextPatch,
    setNodePatch,
    splitNodePatch,
  },
  change$: Subject<EditorChange>,
  portableTextFeatures: PortableTextFeatures,
  incomingPatche$?: PatchObservable
) {
  const patchToOperations = createPatchToOperations(portableTextFeatures)
  let previousChildren: (Node | Partial<Node>)[]
  let isThrottling = false
  return function withPatches(editor: PortableTextSlateEditor) {
    PATCHING.set(editor, true)
    previousChildren = editor.children

    // This will cancel the throttle when the user is not producing anything for a short time
    const cancelThrottle = debounce(() => {
      change$.next({type: 'throttle', throttle: false})
      isThrottling = false
    }, THROTTLE_EDITOR_MS)

    // Inspect incoming patches and adjust editor selection accordingly.
    if (incomingPatche$) {
      incomingPatche$.subscribe((patch: Patch) => {
        previousChildren = editor.children
        debug('Handling incoming patch', patch.type)
        if (isThrottling) {
          withoutPatching(editor, () => {
            if (patchToOperations(editor, patch)) {
              debug('Applied patch in the throttled state', patch.type)
            } else {
              adjustSelection(editor, patch, previousChildren)
            }
          })
        } else {
          debug('Adjusting selection for patch', patch.type)
          adjustSelection(editor, patch, previousChildren)
        }
      })
    }

    const {apply} = editor

    editor.apply = (operation: Operation): void | Editor => {
      let patches: Patch[] = []

      // The previous value is needed to figure out the _key of deleted nodes. The editor.children would no
      // longer contain that information if the node is already deleted.
      // debug('setting previous children', operation, editor.children)
      previousChildren = editor.children

      const editorWasEmpty = isEqualToEmptyEditor(previousChildren, portableTextFeatures)

      // Apply the operation
      apply(operation)

      if (!isPatching(editor)) {
        debug(`Editor is not producing patch for operation ${operation.type}`, operation)
        return editor
      }

      if (editorWasEmpty && operation.type !== 'set_selection') {
        patches = [setIfMissing(previousChildren, [])]
      }

      switch (operation.type) {
        case 'insert_text':
          patches = [...patches, ...insertTextPatch(editor, operation, previousChildren)]
          break
        case 'remove_text':
          patches = [...patches, ...removeTextPatch(editor, operation, previousChildren)]
          break
        case 'remove_node':
          patches = [...patches, ...removeNodePatch(editor, operation, previousChildren)]
          break
        case 'split_node':
          patches = [...patches, ...splitNodePatch(editor, operation, previousChildren)]
          break
        case 'insert_node':
          patches = [...patches, ...insertNodePatch(editor, operation, previousChildren)]
          break
        case 'set_node':
          patches = [...patches, ...setNodePatch(editor, operation, previousChildren)]
          break
        case 'merge_node':
          patches = [...patches, ...mergeNodePatch(editor, operation, previousChildren)]
          break
        case 'move_node':
          patches = [...patches, ...moveNodePatch(editor, operation, previousChildren)]
          break
        case 'set_selection':
        default:
        // Do nothing
      }

      // Unset the value if editor has become empty
      if (
        isEqualToEmptyEditor(editor.children, portableTextFeatures) &&
        operation.type !== 'set_selection'
      ) {
        patches.push(unset([]))
        change$.next({
          type: 'unset',
          previousValue: fromSlateValue(
            previousChildren,
            portableTextFeatures.types.block.name,
            KEY_TO_VALUE_ELEMENT.get(editor)
          ),
        })
      }

      // // TODO: extract this to a test
      // if (debug && !isEqualToEmptyEditor(editor.children, portableTextFeatures)) {
      //   const appliedValue = applyAll(
      //     fromSlateValue(previousChildren, portableTextFeatures.types.block.name),
      //     patches
      //   )

      //   if (
      //     !isEqual(
      //       appliedValue,
      //       fromSlateValue(editor.children, portableTextFeatures.types.block.name)
      //     )
      //   ) {
      //     debug(
      //       'toSlateValue',
      //       JSON.stringify(
      //         toSlateValue(appliedValue, portableTextFeatures.types.block.name),
      //         null,
      //         2
      //       )
      //     )
      //     debug('operation', JSON.stringify(operation, null, 2))
      //     debug('beforeValue', JSON.stringify(previousChildren, null, 2))
      //     debug('afterValue', JSON.stringify(editor.children, null, 2))
      //     debug('appliedValue', JSON.stringify(appliedValue, null, 2))
      //     debug('patches', JSON.stringify(patches, null, 2))
      //     debugger
      //   }
      // }

      if (patches.length > 0) {
        // Signal throttling
        change$.next({type: 'throttle', throttle: true})
        isThrottling = true
        // Emit all patches immediately
        patches.map((patch) => {
          change$.next({
            type: 'patch',
            patch,
          })
        })

        // Emit mutation after user is done typing (we show only local state as that happens)
        change$.next({
          type: 'mutation',
          patches: patches,
        })
        cancelThrottle()
      }
    }
    return editor
  }
}

function adjustSelection(
  editor: Editor,
  patch: Patch,
  previousChildren: (Node | Partial<Node>)[]
): void | Range {
  const selection = editor.selection
  if (selection === null) {
    debug('No selection, not adjusting selection')
    return
  }
  // Text patches on same line
  if (patch.type === 'diffMatchPatch') {
    const [block, blockIndex] = findBlockAndIndexFromPath(patch.path[0], editor.children)
    if (!block) {
      return
    }
    const [child, childIndex] = findChildAndIndexFromPath(patch.path[2], block)
    if (!child) {
      return
    }
    const onSameBlock =
      selection.focus.path[0] === blockIndex && selection.focus.path[1] === childIndex

    if (onSameBlock) {
      const parsed = dmp.patch_fromText(patch.value)[0]
      if (parsed) {
        let testString = ''
        for (const diff of parsed.diffs) {
          if (diff[0] === 0) {
            testString += diff[1]
          } else {
            break
          }
        }
        // This thing is exotic but actually works!
        const isBeforeUserSelection =
          parsed.start1 + testString.length <= selection.focus.offset &&
          parsed.start1 + testString.length <= selection.anchor.offset

        const distance = parsed.length2 - parsed.length1

        if (isBeforeUserSelection) {
          debug('Adjusting selection for diffMatchPatch on same line')
          // debug(
          //   `Adjusting selection for diffMatchPatch on same line ${JSON.stringify({
          //     parsed,
          //     distance,
          //     isBeforeUserSelection,
          //     isRemove: parsed.diffs.some(diff => diff[0] === -1),
          //     testString
          //   })}`
          // )
          const newSelection = {...selection}
          newSelection.focus = {...selection.focus}
          newSelection.anchor = {...selection.anchor}
          newSelection.anchor.offset = newSelection.anchor.offset + distance
          newSelection.focus.offset = newSelection.focus.offset + distance
          Transforms.select(editor, newSelection)
        }
        // TODO: account for intersecting selections!
      }
    }
  }

  // Unset patches on children within a block
  if (patch.type === 'unset' && patch.path.length === 3) {
    const [block, blockIndex] = findBlockAndIndexFromPath(patch.path[0], previousChildren)
    if (!block) {
      debug('No block found trying to adjust for unset child')
      return
    }
    if (selection.focus.path[0] === blockIndex) {
      const [, childIndex] = findChildAndIndexFromPath(patch.path[2], block)
      const prevIndexOrLastIndex =
        childIndex === -1 || block.children.length === 1 ? block.children.length - 1 : childIndex
      const prevText = block.children[prevIndexOrLastIndex].text as Text
      const newSelection = {...selection}
      if (Path.endsAt(selection.anchor.path, [blockIndex, prevIndexOrLastIndex])) {
        newSelection.anchor = {...selection.anchor}
        newSelection.anchor.path = newSelection.anchor.path = [
          newSelection.anchor.path[0],
          Math.max(0, prevIndexOrLastIndex - 1),
        ]
        const textBefore = ((block.children[prevIndexOrLastIndex - 1] &&
          block.children[prevIndexOrLastIndex - 1].text) ||
          '') as Text
        newSelection.anchor.offset = textBefore.length
      }
      if (Path.endsAt(selection.focus.path, [blockIndex, prevIndexOrLastIndex])) {
        newSelection.focus = {...selection.focus}
        newSelection.focus.path = [
          newSelection.focus.path[0],
          Math.max(0, prevIndexOrLastIndex - 1),
        ]
        const textBefore = ((block.children[prevIndexOrLastIndex - 1] &&
          block.children[Math.max(0, prevIndexOrLastIndex - 1)].text) ||
          '') as Text
        newSelection.focus.offset = textBefore.length + prevText.length
      }
      if (Path.isAfter(selection.anchor.path, [blockIndex, prevIndexOrLastIndex])) {
        newSelection.anchor = {...selection.anchor}
        newSelection.anchor.path = newSelection.anchor.path = [
          newSelection.anchor.path[0],
          prevIndexOrLastIndex,
        ]
        newSelection.anchor.offset = selection.anchor.offset + prevText.length
      }
      if (Path.isAfter(selection.focus.path, [blockIndex, prevIndexOrLastIndex])) {
        newSelection.focus = {...selection.anchor}
        newSelection.focus.path = newSelection.anchor.path = [
          newSelection.anchor.path[0],
          prevIndexOrLastIndex,
        ]
        newSelection.anchor.offset = selection.anchor.offset + prevText.length
      }
      if (!isEqual(newSelection, selection)) {
        debug('adjusting selection for unset block child', newSelection)
        Transforms.select(editor, newSelection)
      }
    }
  }

  // Unset patches on block level
  if (patch.type === 'unset' && patch.path.length === 1) {
    let [block, blockIndex] = findBlockAndIndexFromPath(patch.path[0], previousChildren)
    if (!block || typeof blockIndex === 'undefined') {
      debug('no block found in editor trying to adjust selection for unset block')
      // Naively try to adjust as the block above us have been removed.
      blockIndex = Math.max(0, selection.focus.path[0] - 1)
    }
    const newSelection = {...selection}
    if (Path.isAfter(selection.anchor.path, [blockIndex])) {
      newSelection.anchor = {...selection.anchor}
      newSelection.anchor.path = newSelection.anchor.path = [
        Math.max(0, newSelection.anchor.path[0] - 1),
        ...newSelection.anchor.path.slice(1),
      ]
    }
    if (Path.isAfter(selection.focus.path, [blockIndex])) {
      newSelection.focus = {...selection.focus}
      newSelection.focus.path = newSelection.focus.path = [
        Math.max(0, newSelection.focus.path[0] - 1),
        ...newSelection.focus.path.slice(1),
      ]
    }
    if (!isEqual(newSelection, selection)) {
      debug('adjusting selection for unset block')
      Transforms.select(editor, newSelection)
    }
  }

  // Insert patches on block level
  if (patch.type === 'insert' && patch.path.length === 1) {
    const [block, blockIndex] = findBlockAndIndexFromPath(patch.path[0], editor.children)
    if (!block || typeof blockIndex === 'undefined') {
      return
    }
    const newSelection = {...selection}
    if (Path.isAfter(selection.anchor.path, [blockIndex])) {
      newSelection.anchor = {...selection.anchor}
      newSelection.anchor.path = newSelection.anchor.path = [
        newSelection.anchor.path[0] + patch.items.length,
        ...newSelection.anchor.path.slice(1),
      ]
    }
    if (Path.isAfter(selection.focus.path, [blockIndex])) {
      newSelection.focus = {...selection.focus}
      newSelection.focus.path = newSelection.focus.path = [
        newSelection.focus.path[0] + patch.items.length,
        ...newSelection.focus.path.slice(1),
      ]
    }
    if (!isEqual(newSelection, selection)) {
      debug('adjusting selection for insert block')
      Transforms.select(editor, newSelection)
    }
  }

  // Insert patches on block children level
  if (patch.type === 'insert' && patch.path.length === 3) {
    const [block, blockIndex] = findBlockAndIndexFromPath(patch.path[0], editor.children)
    if (!block || typeof blockIndex === 'undefined') {
      return
    }
    const [child, childIndex] = findChildAndIndexFromPath(patch.path[2], block)
    if (!child) {
      return
    }
    if (selection.focus.path[0] === blockIndex && selection.focus.path[1] === childIndex) {
      const nextIndex = childIndex + patch.items.length
      const blockChildren = editor.children[blockIndex].children as Node[]
      const nextBlock = editor.children[blockIndex + 1]
      const isSplitOperation =
        !blockChildren[nextIndex] &&
        Editor.isBlock(editor, nextBlock) &&
        nextBlock.children &&
        nextBlock.children[0] &&
        typeof nextBlock.children[0]._key === 'string' &&
        isEqual(nextBlock.children[0]._key, patch.items[0]._key)
      const [node] = Editor.node(editor, selection)
      const nodeText = node.text as Text
      if (!nodeText) {
        return
      }
      if (selection.focus.offset >= nodeText.length) {
        if (!isSplitOperation) {
          const newSelection = {...selection}
          newSelection.focus = {...selection.focus}
          newSelection.anchor = {...selection.anchor}
          newSelection.anchor.path = Path.next(newSelection.anchor.path)
          newSelection.anchor.offset = nodeText.length - newSelection.anchor.offset
          newSelection.focus.path = Path.next(newSelection.focus.path)
          newSelection.focus.offset = nodeText.length - newSelection.focus.offset
          Transforms.select(editor, newSelection)
        } else if (selection.focus.offset >= nodeText.length) {
          debug('adjusting selection for split node')
          const newSelection = {...selection}
          newSelection.focus = {...selection.focus}
          newSelection.anchor = {...selection.anchor}
          newSelection.anchor.path = [blockIndex + 1, 0]
          newSelection.anchor.offset = selection.anchor.offset - nodeText.length || 0
          newSelection.focus.path = [blockIndex + 1, 0]
          newSelection.focus.offset = selection.focus.offset - nodeText.length || 0
          Transforms.select(editor, newSelection)
        }
      }
    }
  }
  if (editor.selection && editor.selection !== selection) {
    return editor.selection
  }
}
