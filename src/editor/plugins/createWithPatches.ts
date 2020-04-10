import {debounce} from 'lodash'
import {Subject} from 'rxjs'
import {setIfMissing} from '../../patch/PatchEvent'
import {Editor, Operation} from 'slate'
import {Patch} from '../../types/patch'
import {unset} from './../../patch/PatchEvent'
import {fromSlateValue, isEqualToEmptyEditor} from '../../utils/values'
import {PortableTextFeatures} from '../../types/portableText'
import {EditorChange} from '../../types/editor'

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
  portableTextFeatures: PortableTextFeatures
) {
  const cancelThrottle = debounce(() => {
    change$.next({type: 'throttle', throttle: false})
  }, 1000)

  return function withPatches(editor: Editor) {
    const {apply} = editor
    editor.apply = (operation: Operation) => {
      let patches: Patch[] = []

      // The previous value is needed to figure out the _key of deleted nodes. The editor.children would no
      // longer contain that information if the node is already deleted.
      const previousValue = editor.children

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

      // // TODO: Do optional (this is heavy, and should only be done when developing on the editor)
      // const debug = true
      // if (debug && !isEqualToEmptyEditor(editor.children, portableTextFeatures)) {
      //   const appliedValue = applyAll(
      //     fromSlateValue(previousValue, portableTextFeatures.types.block.name),
      //     patches
      //   )

      //   if (
      //     !isEqual(
      //       appliedValue,
      //       fromSlateValue(editor.children, portableTextFeatures.types.block.name)
      //     )
      //   ) {
      //     console.log(
      //       'toSlateValue',
      //       JSON.stringify(
      //         toSlateValue(appliedValue, portableTextFeatures.types.block.name),
      //         null,
      //         2
      //       )
      //     )
      //     console.log('operation', JSON.stringify(operation, null, 2))
      //     console.log('beforeValue', JSON.stringify(previousValue, null, 2))
      //     console.log('afterValue', JSON.stringify(editor.children, null, 2))
      //     console.log('appliedValue', JSON.stringify(appliedValue, null, 2))
      //     console.log('patches', JSON.stringify(patches, null, 2))
      //     debugger
      //   }
      // }

      if (patches.length > 0) {
        // Emit all patches immediately
        patches.map(patch => {
          change$.next({
            type: 'patch',
            patch
          })
        })

        change$.next({type: 'throttle', throttle: true})
        // Emit mutation after user is done typing
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
