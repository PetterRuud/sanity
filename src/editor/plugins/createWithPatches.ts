import * as DMP from 'diff-match-patch'
import {debounce, isEqual} from 'lodash'
import {Subject} from 'rxjs'
import {setIfMissing} from '../../patch/PatchEvent'
import {Editor, Operation, Transforms, Path} from 'slate'
import {Patch} from '../../types/patch'
import {applyAll} from '../../patch/applyPatch'
import {unset} from './../../patch/PatchEvent'
import {
  fromSlateValue,
  isEqualToEmptyEditor,
  toSlateValue,
  findBlockAndIndexFromPath,
  findChildAndIndexFromPath
} from '../../utils/values'
import {PortableTextFeatures} from '../../types/portableText'
import {EditorChange, PatchObservable} from '../../types/editor'
import {debugWithName} from '../../utils/debug'

const debug = debugWithName('plugin:withPatches')

const dmp = new DMP.diff_match_patch()

const THROTTLE_EDITOR_MS = 600

export function createWithPatches(
  {
    insertNodePatch,
    insertTextPatch,
    mergeNodePatch,
    moveNodePatch,
    removeNodePatch,
    removeTextPatch,
    setNodePatch,
    splitNodePatch
  },
  change$: Subject<EditorChange>,
  portableTextFeatures: PortableTextFeatures,
  setMustAdjustSelection: (arg0: boolean) => void,
  incomingPatche$?: PatchObservable
) {
  let isThrottling = false
  let pendingIncoming: Patch[] = []

  let previousChildren

  return function withPatches(editor: Editor) {
    previousChildren = editor.children̈́

    // This will cancel the throttle when the user is not producing anything for a short time
    const cancelThrottle = debounce(() => {
      change$.next({type: 'throttle', throttle: false})
    }, THROTTLE_EDITOR_MS)

    // Inspect incoming patches and adjust editor selection accordingly.
    if (incomingPatche$) {
      incomingPatche$.subscribe((patch: Patch) => {
        if (!isThrottling) {
          setMustAdjustSelection(true)
          adjustSelection(editor, patch, previousChildren)
          setMustAdjustSelection(false)
          editor.onChange()
        } else {
          pendingIncoming.push(patch)
        }
      })
    }

    // Process pending incoming patches while editor was throttling and not adjusting to remote changes
    change$.subscribe((change: EditorChange) => {
      if (change.type === 'throttle') {
        isThrottling = change.throttle
        if (!isThrottling) {
          pendingIncoming.forEach(patch => {
            adjustSelection(editor, patch, previousChildren)
            pendingIncoming.shift()
          })
          editor.onChange()
        }
      }
    })

    const {apply} = editor

    editor.apply = (operation: Operation) => {
      let patches: Patch[] = []

      // The previous value is needed to figure out the _key of deleted nodes. The editor.children would no
      // longer contain that information if the node is already deleted.
      // debug('setting previous children', operation, editor.children)
      previousChildren = editor.children

      const editorWasEmpty = isEqualToEmptyEditor(previousChildren, portableTextFeatures)

      // Apply the operation
      apply(operation)

      if (editorWasEmpty) {
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
      if (isEqualToEmptyEditor(editor.children, portableTextFeatures)) {
        patches.push(unset([]))
        change$.next({
          type: 'unset',
          previousValue: fromSlateValue(previousChildren, portableTextFeatures.types.block.name)
        })
      }

      // TODO: extract this to a test
      if (debug && !isEqualToEmptyEditor(editor.children, portableTextFeatures)) {
        const appliedValue = applyAll(
          fromSlateValue(previousChildren, portableTextFeatures.types.block.name),
          patches
        )

        if (
          !isEqual(
            appliedValue,
            fromSlateValue(editor.children, portableTextFeatures.types.block.name)
          )
        ) {
          debug(
            'toSlateValue',
            JSON.stringify(
              toSlateValue(appliedValue, portableTextFeatures.types.block.name),
              null,
              2
            )
          )
          debug('operation', JSON.stringify(operation, null, 2))
          debug('beforeValue', JSON.stringify(previousChildren, null, 2))
          debug('afterValue', JSON.stringify(editor.children, null, 2))
          debug('appliedValue', JSON.stringify(appliedValue, null, 2))
          debug('patches', JSON.stringify(patches, null, 2))
          debugger
        }
      }

      if (patches.length > 0) {
        // Signal throttling
        change$.next({type: 'throttle', throttle: true})
        // Emit all patches immediately
        patches.map(patch => {
          change$.next({
            type: 'patch',
            patch
          })
        })

        // Emit mutation after user is done typing (we show only local state as that happens)
        change$.next({
          type: 'mutation',
          patches: patches
        })
        // Emit value
        change$.next({
          type: 'value',
          value: fromSlateValue(editor.value, portableTextFeatures.types.block.name)
        })
        cancelThrottle()
      }
    }
    return editor
  }
}

function adjustSelection(editor: Editor, patch: Patch, previousChildren) {
  let selection = editor.selection
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
          debug(
            `Adjusting selection for diffMatchPatch on same line ${JSON.stringify({
              parsed,
              distance,
              isBeforeUserSelection,
              isRemove: parsed.diffs.some(diff => diff[0] === -1),
              testString
            })}`
          )
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
      return
    }
    if (selection.focus.path[0] === blockIndex) {
      const prevText = block.children.slice(-1)[0].text
      const newSelection = {...selection}
      if (Path.isAfter(selection.anchor.path, [blockIndex])) {
        newSelection.anchor = {...selection.anchor}
        newSelection.anchor.path = newSelection.anchor.path = [
          newSelection.anchor.path[0] - 1,
          block.children.length - 1
        ]
        newSelection.anchor.offset = selection.anchor.offset + prevText.length
      }
      if (Path.isAfter(selection.focus.path, [blockIndex])) {
        newSelection.focus = {...selection.focus}
        newSelection.focus.path = newSelection.focus.path = [
          newSelection.focus.path[0] - 1,
          block.children.length - 1
        ]
        newSelection.focus.offset = selection.focus.offset + prevText.length
      }
      debug('adjusting selection for unset block child')
      Transforms.select(editor, newSelection)
    }
  }

  // Unset patches on block level
  if (patch.type === 'unset' && patch.path.length === 1) {
    let [block, blockIndex] = findBlockAndIndexFromPath(patch.path[0], previousChildren)
    if (!block) {
      debug('no block found in editor trying to adjust selection')
      // Naively try to adjust as the block above us have been removed.
      blockIndex = selection.focus.path[0] - 1 || 0
    }
    const newSelection = {...selection}
    if (Path.isAfter(selection.anchor.path, [blockIndex])) {
      newSelection.anchor = {...selection.anchor}
      newSelection.anchor.path = newSelection.anchor.path = [
        newSelection.anchor.path[0] - 1,
        ...newSelection.anchor.path.slice(1)
      ]
    }
    if (Path.isAfter(selection.focus.path, [blockIndex])) {
      newSelection.focus = {...selection.focus}
      newSelection.focus.path = newSelection.focus.path = [
        newSelection.focus.path[0] - 1 || 0,
        ...newSelection.focus.path.slice(1)
      ]
    }
    debug('adjusting selection for unset block')
    Transforms.select(editor, newSelection)
  }

  // Insert patches on block level
  if (patch.type === 'insert' && patch.path.length === 1) {
    const [block, blockIndex] = findBlockAndIndexFromPath(patch.path[0], editor.children)
    if (!block) {
      return
    }
    const newSelection = {...selection}
    if (Path.isAfter(selection.anchor.path, [blockIndex])) {
      newSelection.anchor = {...selection.anchor}
      newSelection.anchor.path = newSelection.anchor.path = [
        newSelection.anchor.path[0] + patch.items.length,
        ...newSelection.anchor.path.slice(1)
      ]
    }
    if (Path.isAfter(selection.focus.path, [blockIndex])) {
      newSelection.focus = {...selection.focus}
      newSelection.focus.path = newSelection.focus.path = [
        newSelection.focus.path[0] + patch.items.length,
        ...newSelection.focus.path.slice(1)
      ]
    }
    debug('adjusting selection for insert block')
    Transforms.select(editor, newSelection)
  }

  // Insert patches on block children level
  if (patch.type === 'insert' && patch.path.length === 3) {
    const [block, blockIndex] = findBlockAndIndexFromPath(patch.path[0], editor.children)
    if (!block) {
      return
    }
    const [child, childIndex] = findChildAndIndexFromPath(patch.path[2], block)
    if (!child) {
      return
    }
    if (selection.focus.path[0] === blockIndex && selection.focus.path[1] === childIndex) {
      const nextIndex = childIndex + patch.items.length
      const isSplitOperation =
        !editor.children[blockIndex].children[nextIndex] &&
        editor.children[blockIndex + 1] &&
        editor.children[blockIndex + 1].children &&
        editor.children[blockIndex + 1].children[0] &&
        isEqual(editor.children[blockIndex + 1].children[0]._key, patch.items[0]['_key'])
      const [node] = Editor.node(editor, selection)
      const nodeText = node.text
      if (!nodeText) {
        return
      }
      if (!isSplitOperation) {
        const newSelection = {...selection}
        newSelection.focus = {...selection.focus}
        newSelection.anchor = {...selection.anchor}
        newSelection.anchor.path = Path.next(newSelection.anchor.path)
        newSelection.anchor.offset = nodeText.length - newSelection.anchor.offset
        newSelection.focus.path = Path.next(newSelection.focus.path)
        newSelection.focus.offset = nodeText.length - newSelection.focus.offset
        Transforms.select(editor, newSelection)
      } else {
        if (selection.focus.offset >= nodeText.length) {
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
}
