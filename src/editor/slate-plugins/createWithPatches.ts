import {isEqual} from 'lodash'
import {applyAll} from '../../patch/applyPatch'
import {unset, setIfMissing} from '../../patch/PatchEvent'
import {Editor, Operation} from 'slate'
import {Patch} from '../../types/patch'
import {PortableTextFeatures} from '../../types/portableText'
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
  patchSubject: any,
  portableTextFeatures: PortableTextFeatures
) {
  function isEmptyEditor(children) {
    return (
      children.length === 0 ||
      (children.length === 1 &&
        children[0]._type === portableTextFeatures.types.block.name &&
        children[0].children &&
        children[0].children.length === 1 &&
        children[0].children[0]._type === 'span' &&
        children[0].children[0].text === '')
    )
  }
  return function withPatches(editor: Editor) {
    const {apply} = editor
    editor.apply = (operation: Operation) => {
      let patches: Patch[] = []
      // beforeValue is needed to figure out the _key of deleted nodes. The editor.children would no
      // longer contain that information if the node is already deleted.
      const beforeValue = editor.children

      const editorWasEmpty = isEmptyEditor(beforeValue)

      // Apply the operation
      apply(operation)

      const editorIsEmpty = isEmptyEditor(editor.children)

      if (editorWasEmpty) {
        patches = [setIfMissing(beforeValue, [])]
      }

      switch (operation.type) {
        case 'insert_text':
          patches = [...patches, ...insertTextPatch(editor, operation, beforeValue)]
          break
        case 'remove_text':
          patches = [...patches, ...removeTextPatch(editor, operation, beforeValue)]
          break
        case 'remove_node':
          patches = [...patches, ...removeNodePatch(editor, operation, beforeValue)]
          break
        case 'split_node':
          patches = [...patches, ...splitNodePatch(editor, operation, beforeValue)]
          break
        case 'insert_node':
          patches = [...patches, ...insertNodePatch(editor, operation, beforeValue)]
          break
        case 'set_node':
          patches = [...patches, ...setNodePatch(editor, operation, beforeValue)]
          break
        case 'merge_node':
          patches = [...patches, ...mergeNodePatch(editor, operation, beforeValue)]
          break
        case 'set_selection':
        default:
          patches = []
      }

      if (!editorWasEmpty && editorIsEmpty) {
        patches = patches.concat(unset([]))
      }

      // TODO: remove this debug integrity check!
      if (!editorIsEmpty) {
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
