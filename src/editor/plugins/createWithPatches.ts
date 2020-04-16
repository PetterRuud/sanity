import * as DMP from 'diff-match-patch'
import {debounce, isEqual} from 'lodash'
import {Subject} from 'rxjs'
import {setIfMissing} from '../../patch/PatchEvent'
import {Editor, Operation, Transforms} from 'slate'
import {Patch, DiffMatchPatch, InsertPatch, UnsetPatch} from '../../types/patch'
import {applyAll} from '../../patch/applyPatch'
import {unset} from './../../patch/PatchEvent'
import {fromSlateValue, isEqualToEmptyEditor, toSlateValue} from '../../utils/values'
import {PortableTextFeatures} from '../../types/portableText'
import {EditorChange} from '../../types/editor'

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
  incomingPatche$?: Subject<Patch>
) {
  const cancelThrottle = debounce(() => {
    change$.next({type: 'throttle', throttle: false})
  }, 1000)

  let previousValue

  return function withPatches(editor: Editor) {
    function adjustSelection(editor: Editor, patch: DiffMatchPatch | InsertPatch | UnsetPatch) {
      if (editor.selection === null) {
        return
      }

      // Text patches on same line
      if (patch.type === 'diffMatchPatch') {
        const blockIndex = editor.children.findIndex(blk =>
          isEqual({_key: blk._key}, patch.path[0])
        )
        const block = editor.children[blockIndex]
        if (!block) {
          return
        }
        const childIndex = block.children.findIndex(child =>
          isEqual({_key: child._key}, patch.path[2])
        )
        if (
          childIndex !== -1 &&
          editor.selection.focus.path[0] === blockIndex &&
          editor.selection.focus.path[1] === childIndex
        ) {
          const parsed = dmp.patch_fromText(patch.value)[0]
          if (parsed) {
            let testString = ''
            const [node] = Editor.node(editor, editor.selection)
            const nodeText = node.text
            for (const diff of parsed.diffs) {
              if (diff[0] === 0) {
                testString += diff[1]
              }
            }
            const isBefore =
              (!nodeText
                .substring(parsed.start1, parsed.length2)
                .startsWith(testString.substring) &&
                parsed.start1 < editor.selection.focus.offset &&
                parsed.start1 < editor.selection.anchor.offset) ||
              parsed.diffs[0][0] === 1

            // const isRemove = parsed.diffs.some(diff => diff[0] === -1)
            // console.log(JSON.stringify(parsed, null, 2))
            // console.log('isbefore', isBefore)
            // console.log('isRemove', isRemove)
            // console.log('nodeTextSubtring', JSON.stringify(nodeText.substring(parsed.start1)))
            // console.log('testString', JSON.stringify(testString))

            if (isBefore) {
              const distance = parsed.length2 - parsed.length1
              const newSelection = {...editor.selection}
              newSelection.focus = {...editor.selection.focus}
              newSelection.anchor = {...editor.selection.anchor}
              Transforms.deselect(editor)
              newSelection.anchor.offset = newSelection.anchor.offset + distance
              newSelection.focus.offset = newSelection.focus.offset + distance
              Transforms.select(editor, newSelection)
              editor.onChange()
            }
          }
        }
      }

      // Unset patches
      if (patch.type === 'unset' && patch.path.length === 1) {
        // TODO: take care of line splitting
      }

      // Insert  patches
      if (patch.type === 'insert' && patch.path.length === 1) {
        // TODO: take care of line splitting
      }
    }

    // Investigate incoming patches and adjust editor accordingly.
    if (incomingPatche$) {
      incomingPatche$.subscribe(patch => {
        if (patch.type === 'diffMatchPatch' || patch.type === 'insert' || patch.type === 'unset') {
          adjustSelection(editor, patch)
        }
      })
    }

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
          patches = []
      }

      // Unset the value if editor has become empty
      if (isEqualToEmptyEditor(editor.children, portableTextFeatures)) {
        patches.push(unset([]))
        change$.next({
          type: 'unset',
          previousValue: fromSlateValue(previousValue, portableTextFeatures.types.block.name)
        })
      }

      // TODO: Do optional (this is heavy, and should only be done when developing on the editor)
      const debug = true
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
          console.log(
            'toSlateValue',
            JSON.stringify(
              toSlateValue(appliedValue, portableTextFeatures.types.block.name),
              null,
              2
            )
          )
          console.log('operation', JSON.stringify(operation, null, 2))
          console.log('beforeValue', JSON.stringify(previousValue, null, 2))
          console.log('afterValue', JSON.stringify(editor.children, null, 2))
          console.log('appliedValue', JSON.stringify(appliedValue, null, 2))
          console.log('patches', JSON.stringify(patches, null, 2))
          debugger
        }
      }

      if (patches.length > 0) {
        // Emit all patches immediately
        patches.map(patch => {
          change$.next({
            type: 'patch',
            patch
          })
        })

        // Signal throttling
        change$.next({type: 'throttle', throttle: true})
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
