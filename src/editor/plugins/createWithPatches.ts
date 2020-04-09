import {isEqual, debounce} from 'lodash'
import {Subject} from 'rxjs'
import {applyAll} from '../../patch/applyPatch'
import {unset, setIfMissing} from '../../patch/PatchEvent'
import {Editor, Operation, Transforms} from 'slate'
import {Patch} from '../../types/patch'
import {toSlateValue, fromSlateValue} from '../../utils/values'
// import {toPortableTextRange} from '../../utils/selection'
import {PortableTextFeatures, PortableTextBlock} from '../../types/portableText'
import {EditorChange} from 'src/types/editor'
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
  createPlaceHolderBlock: () => PortableTextBlock
) {
  function isEqualToEmptyEditor(children) {
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
  const cancelThrottle = debounce(() => {
    change$.next({type: 'throttle', throttle: false})
  }, 1000)

  return function withPatches(editor: Editor) {
    const {apply} = editor
    editor.apply = (operation: Operation) => {
      let patches: Patch[] = []
      // beforeValue is needed to figure out the _key of deleted nodes. The editor.children would no
      // longer contain that information if the node is already deleted.
      const beforeValue = editor.children

      const editorWasEmpty = isEqualToEmptyEditor(beforeValue)

      // Apply the operation
      apply(operation)

      const editorIsEmpty = isEqualToEmptyEditor(editor.children)

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
        case 'move_node':
            // Doesn't seem to be implemented in Slate at the moment (april 2020)
            // TODO: confirm this
          debugger
          break
        case 'set_selection':
        default:
          patches = []
      }

      // Unset the value remote if editor has become empty
      // TODO: figure out a nice patter for this that works well with undo
      if (!editorWasEmpty && editorIsEmpty) {
        Transforms.deselect(editor)
        // editor.children.forEach((_, index) => {
        //   Transforms.removeNodes(editor, {at: [index]})
        // })
        // // Insert placeholderblock
        // const nodes = toSlateValue(
        //   [createPlaceHolderBlock()],
        //   portableTextFeatures.types.block.name
        // )
        // Transforms.insertNodes(editor, nodes, {at: [0]})
        change$.next({
          type: 'unset',
          placeholderValue: fromSlateValue(beforeValue, portableTextFeatures.types.block.name)
        })

        // TODO: transform undo so that it inserts a setIfMissing patch with before value first, before doing the the undo patches

        // Restore the cursor in the placeholder block
        // setTimeout(() => {
        //   Transforms.select(editor, {
        //     anchor: {path: [0, 0], offset: 0},
        //     focus: {path: [0, 0], offset: 0}
        //   })
        // }, 100)
        // editor.onChange()
        patches.push(unset([]))
      }

      // TODO: Do optional (this is heavy, and should only be done when developing on the editor)
      const debug = true
      if (debug && !editorIsEmpty) {
        const appliedValue = applyAll(
          fromSlateValue(beforeValue, portableTextFeatures.types.block.name),
          patches
        )
        // change$.next({type: 'value', value: appliedValue})

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
          console.log('beforeValue', JSON.stringify(beforeValue, null, 2))
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
        change$.next({type: 'throttle', throttle: true})
        // Emit mutation after user is done typing
        change$.next({
          type: 'mutation',
          patches: patches
        })
        cancelThrottle()
      }
    }
    return editor
  }
}
