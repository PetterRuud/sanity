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

export function createWithPatches(
  {
    insertNodePatch,
    insertTextPatch,
    mergeNodePatch,
    removeNodePatch,
    removeTextPatch,
    setNodePatch,
    splitNodePatch
  },
  change$: Subject<EditorChange>,
  portableTextFeatures: PortableTextFeatures,
  incomingPatche$?: PatchObservable
) {
  let isThrottling = false
  let pendingIncoming: Patch[] = []

  let previousValue

  return function withPatches(editor: Editor) {
    const cancelThrottle = debounce(() => {
      change$.next({type: 'throttle', throttle: false})
    }, 600)

    function adjustSelection(editor: Editor, patch: Patch) {
      if (editor.selection === null) {
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
        if (
          editor.selection.focus.path[0] === blockIndex &&
          editor.selection.focus.path[1] === childIndex
        ) {
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
            const isBefore =
              parsed.start1 + testString.length <= editor.selection.focus.offset &&
              parsed.start1 + testString.length <= editor.selection.anchor.offset

            const distance = parsed.length2 - parsed.length1
            const isRemove = parsed.diffs.some(diff => diff[0] === -1)
            debug('diffmatchPatch', JSON.stringify(parsed, null, 2))
            debug('editor.selection', JSON.stringify(editor.selection, null, 2))
            debug('isbefore', isBefore)
            debug('isRemove', isRemove)
            debug('distance', distance)
            debug('testString', JSON.stringify(testString))
            if (isBefore) {
              const newSelection = {...editor.selection}
              newSelection.focus = {...editor.selection.focus}
              newSelection.anchor = {...editor.selection.anchor}
              newSelection.anchor.offset = newSelection.anchor.offset + distance
              newSelection.focus.offset = newSelection.focus.offset + distance
              Transforms.select(editor, newSelection)
            }
          }
        }
      }

      // TODO: complete this
      // Unset patches
      if (patch.type === 'unset' && patch.path.length === 3) {
        debug('adjust for merge node')
        const [block, blockIndex] = findBlockAndIndexFromPath(patch.path[0], previousValue)
        if (!block) {
          return
        }
        const prevText = block.children.slice(-1)[0].text
        const newSelection = {...editor.selection}
        if (Path.isAfter(editor.selection.anchor.path, [blockIndex])) {
          newSelection.anchor = {...editor.selection.anchor}
          newSelection.anchor.path = newSelection.anchor.path = [
            newSelection.anchor.path[0] - 1,
            block.children.length - 1
          ]
          newSelection.anchor.offset = editor.selection.anchor.offset + prevText.length
        }
        if (Path.isAfter(editor.selection.focus.path, [blockIndex])) {
          newSelection.focus = {...editor.selection.focus}
          newSelection.focus.path = newSelection.focus.path = [
            newSelection.focus.path[0] - 1,
            block.children.length - 1
          ]
          newSelection.focus.offset = editor.selection.focus.offset + prevText.length
        }
        Transforms.select(editor, newSelection)
        editor.onChange()
      }

      // Unset patches on block level
      if (patch.type === 'unset' && patch.path.length === 1) {
        const [block, blockIndex] = findBlockAndIndexFromPath(patch.path[0], previousValue)
        if (!block) {
          return
        }
        const newSelection = {...editor.selection}
        if (Path.isAfter(editor.selection.anchor.path, [blockIndex])) {
          newSelection.anchor = {...editor.selection.anchor}
          newSelection.anchor.path = newSelection.anchor.path = [
            newSelection.anchor.path[0] - 1,
            ...newSelection.anchor.path.slice(1)
          ]
        }
        if (Path.isAfter(editor.selection.focus.path, [blockIndex])) {
          newSelection.focus = {...editor.selection.focus}
          newSelection.focus.path = newSelection.focus.path = [
            newSelection.focus.path[0] - 1,
            ...newSelection.focus.path.slice(1)
          ]
        }
        Transforms.select(editor, newSelection)
        editor.onChange()
      }

      // Insert patches on block level
      if (patch.type === 'insert' && patch.path.length === 1) {
        const [block, blockIndex] = findBlockAndIndexFromPath(patch.path[0], editor.children)
        if (!block) {
          return
        }
        const newSelection = {...editor.selection}
        if (Path.isAfter(editor.selection.anchor.path, [blockIndex])) {
          newSelection.anchor = {...editor.selection.anchor}
          newSelection.anchor.path = newSelection.anchor.path = [
            newSelection.anchor.path[0] + patch.items.length,
            ...newSelection.anchor.path.slice(1)
          ]
        }
        if (Path.isAfter(editor.selection.focus.path, [blockIndex])) {
          newSelection.focus = {...editor.selection.focus}
          newSelection.focus.path = newSelection.focus.path = [
            newSelection.focus.path[0] + patch.items.length,
            ...newSelection.focus.path.slice(1)
          ]
        }
        Transforms.select(editor, newSelection)
        editor.onChange()
      }

      if (patch.type === 'insert' && patch.path.length === 3) {
        const [block, blockIndex] = findBlockAndIndexFromPath(patch.path[0], editor.children)
        if (!block) {
          return
        }
        const [child, childIndex] = findChildAndIndexFromPath(patch.path[2], block)
        if (!child) {
          return
        }
        if (
          editor.selection.focus.path[0] === blockIndex &&
          editor.selection.focus.path[1] === childIndex
        ) {
          const nextIndex = childIndex + patch.items.length
          const isSplitOperation =
            !editor.children[blockIndex].children[nextIndex] &&
            editor.children[blockIndex + 1] &&
            editor.children[blockIndex + 1].children &&
            editor.children[blockIndex + 1].children[0] &&
            isEqual(editor.children[blockIndex + 1].children[0]._key, patch.items[0]['_key'])
          const [node] = Editor.node(editor, editor.selection)
          const nodeText = node.text
          if (!isSplitOperation) {
            const newSelection = {...editor.selection}
            newSelection.focus = {...editor.selection.focus}
            newSelection.anchor = {...editor.selection.anchor}
            newSelection.anchor.path = Path.next(newSelection.anchor.path)
            newSelection.anchor.offset = nodeText.length - newSelection.anchor.offset
            newSelection.focus.path = Path.next(newSelection.focus.path)
            newSelection.focus.offset = nodeText.length - newSelection.focus.offset
            Transforms.select(editor, newSelection)
          } else {
            if (editor.selection.focus.offset >= nodeText.length) {
              debug('adjusting split node')
              const newSelection = {...editor.selection}
              newSelection.focus = {...editor.selection.focus}
              newSelection.anchor = {...editor.selection.anchor}
              newSelection.anchor.path = [blockIndex + 1, 0]
              newSelection.anchor.offset = editor.selection.anchor.offset - nodeText.length || 0
              newSelection.focus.path = [blockIndex + 1, 0]
              newSelection.focus.offset = editor.selection.focus.offset - nodeText.length || 0
              Transforms.select(editor, newSelection)
              editor.onChange()
            }
          }
        }
        // TODO: take care of line merging?
      }
    }

    // Investigate incoming patches and adjust editor accordingly.
    if (incomingPatche$) {
      incomingPatche$.subscribe((patch: Patch) => {
        if (!isThrottling) {
          adjustSelection(editor, patch)
        } else {
          pendingIncoming.push(patch)
        }
      })
    }

    change$.subscribe((change: EditorChange) => {
      if (change.type === 'throttle') {
        isThrottling = change.throttle
        if (!isThrottling) {
          const incomingNow = [...pendingIncoming]
          incomingNow.forEach(patch => {
            adjustSelection(editor, patch)
            pendingIncoming.shift()
          })
        }
      }
    })

    const {apply} = editor

    editor.apply = (operation: Operation) => {
      let patches: Patch[] = []

      // The previous value is needed to figure out the _key of deleted nodes. The editor.children would no
      // longer contain that information if the node is already deleted.
      previousValue = editor.children

      const editorWasEmpty = isEqualToEmptyEditor(previousValue, portableTextFeatures)

      // Apply the operation
      apply(operation)

      if (editorWasEmpty) {
        patches = [setIfMissing(previousValue, [])]
      }

      switch (operation.type) {
        case 'insert_text':
          patches = [...patches, ...insertTextPatch(editor, operation, previousValue)]
          break
        case 'remove_text':
          patches = [...patches, ...removeTextPatch(editor, operation, previousValue)]
          break
        case 'remove_node':
          patches = [...patches, ...removeNodePatch(editor, operation, previousValue)]
          break
        case 'split_node':
          patches = [...patches, ...splitNodePatch(editor, operation, previousValue)]
          break
        case 'insert_node':
          patches = [...patches, ...insertNodePatch(editor, operation, previousValue)]
          break
        case 'set_node':
          patches = [...patches, ...setNodePatch(editor, operation, previousValue)]
          break
        case 'merge_node':
          patches = [...patches, ...mergeNodePatch(editor, operation, previousValue)]
          break
        case 'move_node':
          // Doesn't seem to be implemented in Slate at the moment (april 2020)
          // TODO: confirm this
          debugger
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
          previousValue: fromSlateValue(previousValue, portableTextFeatures.types.block.name)
        })
      }

      if (debug && !isEqualToEmptyEditor(editor.children, portableTextFeatures)) {
        const appliedValue = applyAll(
          fromSlateValue(previousValue, portableTextFeatures.types.block.name),
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
          debug('beforeValue', JSON.stringify(previousValue, null, 2))
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
