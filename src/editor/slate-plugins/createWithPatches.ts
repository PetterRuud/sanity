import {applyAll} from '../../patch/applyPatch'
import {isEqual} from 'lodash'
import {Editor, Operation} from 'slate'
export function createWithPatches({
  insertNodePatch,
  insertTextPatch,
  mergeNodePatch,
  removeNodePatch,
  removeTextPatch,
  setNodePatch,
  splitNodePatch,
}, patchSubject: any) {
  return function withPatches(editor: Editor) {
    const {apply} = editor
    let patches = []
    editor.apply = (operation: Operation) => {
      // beforeValue is needed to figure out the _key of deleted nodes. The editor.children would no
      // longer contain that information if the node is already deleted.
      const beforeValue = editor.children

      // Apply the operation
      apply(operation)

      switch (operation.type) {
        case 'insert_text':
          patches = insertTextPatch(editor, operation, beforeValue)
          break
        case 'remove_text':
          patches = removeTextPatch(editor, operation, beforeValue)
          break
        case 'remove_node':
          patches = removeNodePatch(editor, operation, beforeValue)
          break
        case 'split_node':
          patches = splitNodePatch(editor, operation, beforeValue)
          break
        case 'insert_node':
          patches = insertNodePatch(editor, operation, beforeValue)
          break
        case 'set_node':
          patches = setNodePatch(editor, operation, beforeValue)
          break
        case 'merge_node':
          patches = mergeNodePatch(editor, operation, beforeValue)
          break
        case 'set_selection':
        default:
          patches = []
      }

      // TODO: remove this debug integrity check!
      if (true) {
        const appliedValue = applyAll(beforeValue, patches)
        if (!isEqual(appliedValue, editor.children)) {
          console.log('operation', JSON.stringify(operation, null, 2))
          console.log('beforeValue', JSON.stringify(beforeValue, null, 2))
          console.log('afterValue', JSON.stringify(editor.children, null, 2))
          console.log('appliedValue', JSON.stringify(appliedValue, null, 2))
          console.log('patches', JSON.stringify(patches, null, 2))
          debugger
        }
      }

      if (patches.length > 0) {
        patchSubject.next({patches, editor})
      }
    }
    return editor
  }
}
