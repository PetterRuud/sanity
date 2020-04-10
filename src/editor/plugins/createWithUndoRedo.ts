import {Subject} from 'rxjs'
import {Editor, Operation, Path, createEditor, Transforms} from 'slate'
import {Patch} from '../../types/patch'
import {EditorChange} from 'src/types/editor'
import {toPortableTextRange} from '../../utils/selection'
import {createWithObjectKeys} from '.'
import {PortableTextFeatures} from '../../types/portableText'
import {setIfMissing} from '../../patch/PatchEvent'
import {isEqualToEmptyEditor, fromSlateValue} from '../../utils/values'
import {isEqual} from 'lodash'
import {compactPatches} from '../../utils/patches'
export interface History {
  redos: {operations: Operation[]; value: Node[]}[]
  undos: {operations: Operation[]; value: Node[]}[]
}

const SAVING = new WeakMap<Editor, boolean | undefined>()
const MERGING = new WeakMap<Editor, boolean | undefined>()
const UNDO_STEP_LIMIT = 300

const isMerging = (editor: Editor): boolean | undefined => {
  return MERGING.get(editor)
}

const isSaving = (editor: Editor): boolean | undefined => {
  return SAVING.get(editor)
}

export function createWithUndoRedo(
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
  keyGenerator: () => string
) {
  // A bogus editor that we can use to produce undo/redo patches without changing the user editor
  const dummyEditor = createWithObjectKeys(portableTextFeatures, keyGenerator)(createEditor())

  function toPatches(editor, operations, isRedo) {
    let inversePatches: Patch[] = []
    let inverseOps
    if (isRedo) {
      inverseOps = operations
    } else {
      inverseOps = operations.map(Operation.inverse).reverse()
    }

    // Reset dummyeditor
    dummyEditor.operations = []
    dummyEditor.children = editor.children
    dummyEditor.selection = null
    Editor.withoutNormalizing(dummyEditor, () => {
      if (editor.selection) {
        Transforms.select(dummyEditor, editor.selection)
      }
      for (const op of inverseOps) {
        // If the final operation is deselecting the editor, skip it.
        if (
          op === inverseOps[inverseOps.length - 1] &&
          op.type === 'set_selection' &&
          op.newProperties == null
        ) {
          continue
        } else {
          dummyEditor.apply(op)
        }
        switch (op.type) {
          case 'insert_text':
            inversePatches = [
              ...inversePatches,
              ...insertTextPatch(dummyEditor, op, editor.children)
            ]
            break
          case 'remove_text':
            inversePatches = [
              ...inversePatches,
              ...removeTextPatch(dummyEditor, op, editor.children)
            ]
            break
          case 'remove_node':
            inversePatches = [
              ...inversePatches,
              ...removeNodePatch(dummyEditor, op, editor.children)
            ]
            break
          case 'split_node':
            inversePatches = [
              ...inversePatches,
              ...splitNodePatch(dummyEditor, op, editor.children)
            ]
            break
          case 'insert_node':
            inversePatches = [
              ...inversePatches,
              ...insertNodePatch(dummyEditor, op, editor.children)
            ]
            break
          case 'set_node':
            inversePatches = [...inversePatches, ...setNodePatch(dummyEditor, op, editor.children)]
            break
          case 'merge_node':
            inversePatches = [
              ...inversePatches,
              ...mergeNodePatch(dummyEditor, op, editor.children)
            ]
            break
          case 'move_node':
            // Doesn't seem to be implemented in Slate at the moment (april 2020)
            // TODO: confirm this
            debugger
            break
          case 'set_selection':
          default:
            inversePatches = []
        }
      }
    })
    return inversePatches
  }
  return (editor: Editor) => {
    editor.history = {undos: [], redos: []}
    const {apply} = editor
    editor.apply = (op: Operation) => {
      const {operations, history} = editor
      const {undos} = history
      const lastBatch = undos[undos.length - 1]
      const lastOp =
        lastBatch && lastBatch.operations && lastBatch.operations[lastBatch.operations.length - 1]
      const overwrite = shouldOverwrite(op, lastOp)
      let save = isSaving(editor)
      let merge = isMerging(editor)

      if (save == null) {
        save = shouldSave(op, lastOp)
      }

      if (save) {
        if (merge == null) {
          if (lastBatch == null) {
            merge = false
          } else if (operations.length !== 0) {
            merge = true
          } else {
            merge = shouldMerge(op, lastOp) || overwrite
          }
        }

        if (lastBatch && merge) {
          if (overwrite) {
            lastBatch.operations.pop()
          }
          lastBatch.operations.push(op)
        } else {
          const operations = [op]
          undos.push({
            operations,
            timestamp: new Date(),
            selection: toPortableTextRange(editor)
          })
        }

        while (undos.length > UNDO_STEP_LIMIT) {
          undos.shift()
        }

        if (shouldClear(op)) {
          history.redos = []
        }
      }
      apply(op)
    }

    editor.undo = () => {
      // TODO: if it goes backwards/forwards (deleting lines upwards) select last/first block focus
      const {undos} = editor.history
      if (undos.length > 0) {
        const lastBatch = undos[undos.length - 1]
        if (lastBatch.operations.length > 0) {
          const inversePatches = toPatches(editor, lastBatch.operations, false)
          // Add special setIfMissing patch for deletion of value (it's unset by withPatches plugin)
          if (isEqualToEmptyEditor(editor.children, portableTextFeatures)) {
            const prevValue = fromSlateValue(editor.children, portableTextFeatures.types.block.name)
            inversePatches.unshift(setIfMissing(prevValue, []))
          }
          change$.next({
            type: 'undo',
            patches: inversePatches,
            selection: lastBatch.selection,
            timestamp: lastBatch.timestamp
          })
        }
        editor.history.redos.push(lastBatch)
        editor.history.undos.pop()
      }
    }

    editor.redo = () => {
      // TODO: if it goes backwards/forwards (deleting lines upwards) select last/first block focus
      const {redos} = editor.history
      if (redos.length > 0) {
        const lastBatch = redos[redos.length - 1]
        if (lastBatch.operations.length > 0) {
          let patches = toPatches(editor, lastBatch.operations, true)
          // If adjecent diffMatchPatches, use the last one.
          if (
            patches.every(
              patch =>
                (patch.type === 'diffMatchPatch' && isEqual(patch.path, patches[0].path)) ||
                (patch.type === 'set' && isEqual(patch.path, patches[0].path))
            )
          ) {
            patches = patches.slice(-1)
          }
          change$.next({
            type: 'redo',
            patches,
            selection: lastBatch.selection,
            timestamp: lastBatch.timestamp
          })
        }
        editor.history.undos.push(lastBatch)
        editor.history.redos.pop()
      }
    }

    // Plugin return
    return editor
  }
}

const shouldMerge = (op: Operation, prev: Operation | undefined): boolean => {
  if (op.type === 'set_selection') {
    return true
  }

  // Text input
  if (
    prev &&
    op.type === 'insert_text' &&
    prev.type === 'insert_text' &&
    op.offset === prev.offset + prev.text.length &&
    Path.equals(op.path, prev.path) &&
    op.text !== ' ' // Tokenize between words
  ) {
    return true
  }

  // Text deletion
  if (
    prev &&
    op.type === 'remove_text' &&
    prev.type === 'remove_text' &&
    op.offset + op.text.length === prev.offset &&
    Path.equals(op.path, prev.path)
  ) {
    return true
  }

  // Don't merge
  return false
}

const shouldSave = (op: Operation, prev: Operation | undefined): boolean => {
  if (op.type === 'set_selection' && op.newProperties == null) {
    return false
  }

  return true
}

const shouldOverwrite = (op: Operation, prev: Operation | undefined): boolean => {
  if (prev && op.type === 'set_selection' && prev.type === 'set_selection') {
    return true
  }

  return false
}

const shouldClear = (op: Operation): boolean => {
  if (op.type === 'set_selection') {
    return false
  }

  return true
}
