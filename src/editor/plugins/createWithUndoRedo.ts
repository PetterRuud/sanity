import {Subject} from 'rxjs'
import {Editor, Operation, Path, createEditor, Transforms} from 'slate'
import {Patch} from '../../types/patch'
import {EditorChange, EditorSelection} from 'src/types/editor'
import {toPortableTextRange} from '../../utils/selection'
import {createWithObjectKeys} from '.'
import {PortableTextFeatures} from '../../types/portableText'
import {setIfMissing, unset} from '../../patch/PatchEvent'
import {isEqualToEmptyEditor, fromSlateValue} from '../../utils/values'

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
  // A temporary editor to produce undo/redo patches without changing the user editor
  const dummyEditor = createWithObjectKeys(portableTextFeatures, keyGenerator)(createEditor())

  function toPatches(editor, operations, isRedo): {patches: Patch[], selection: EditorSelection} {
    let patches: Patch[] = []
    const undoRedoOps = isRedo ? operations : operations.map(Operation.inverse).reverse()

    // Reset dummyeditor
    dummyEditor.operations = []
    dummyEditor.children = editor.children
    dummyEditor.selection = null
    let redoSelection: EditorSelection = null

    Editor.withoutNormalizing(dummyEditor, () => {
      if (editor.selection) {
        Transforms.select(dummyEditor, editor.selection)
      }
      for (const op of undoRedoOps) {
        const prevValue = dummyEditor.children
        // If the final operation is deselecting the editor, skip it.
        if (
          op === undoRedoOps[undoRedoOps.length - 1] &&
          op.type === 'set_selection' &&
          op.newProperties == null
        ) {
          continue
        } else {
          dummyEditor.apply(op)
        }
        redoSelection = toPortableTextRange(dummyEditor)
        switch (op.type) {
          case 'insert_text':
            patches = [...patches, ...insertTextPatch(dummyEditor, op, prevValue)]
            break
          case 'remove_text':
            patches = [...patches, ...removeTextPatch(dummyEditor, op, prevValue)]
            break
          case 'remove_node':
            patches = [...patches, ...removeNodePatch(dummyEditor, op, prevValue)]
            break
          case 'split_node':
            patches = [...patches, ...splitNodePatch(dummyEditor, op, prevValue)]
            break
          case 'insert_node':
            patches = [...patches, ...insertNodePatch(dummyEditor, op, prevValue)]
            break
          case 'set_node':
            patches = [...patches, ...setNodePatch(dummyEditor, op, prevValue)]
            break
          case 'merge_node':
            patches = [...patches, ...mergeNodePatch(dummyEditor, op, prevValue)]
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
      }
    })
    return {patches, selection: isRedo? redoSelection : toPortableTextRange(dummyEditor)}
  }
  return (editor: Editor) => {
    editor.history = {undos: [], redos: []}
    const {apply} = editor
    // Apply function for merging and saving local history inspired from 'slate-history' by Ian Storm Taylor
    editor.apply = (op: Operation) => {
      const {operations, history} = editor
      const {undos} = history
      let lastBatch = undos[undos.length - 1]
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
            patches: {undo: [], redo: []},
            selection: {undo: [], redo: []}
          })
        }

        while (undos.length > UNDO_STEP_LIMIT) {
          undos.shift()
        }

        if (shouldClear(op)) {
          history.redos = []
        }
      }
      const prevValue = fromSlateValue(editor.children, portableTextFeatures.types.block.name)
      apply(op)
      lastBatch = undos[undos.length - 1]
      if (lastBatch) {
        lastBatch.redoSelection = toPortableTextRange(editor)
        const {patches, selection} = toPatches(editor, lastBatch.operations, false)
        lastBatch.patches.undo = patches
        lastBatch.selection.undo = selection
        // setIfMissing patch when the value is unset by withPatches plugin
        if (isEqualToEmptyEditor(editor.children, portableTextFeatures)) {
          lastBatch.patches.undo = [setIfMissing(prevValue, [])]
          lastBatch.patches.redo.unshift(unset([]))
        }
      }
    }

    editor.undo = () => {
      // TODO: if it goes backwards/forwards (deleting lines upwards) select last/first block focus
      const {undos} = editor.history
      if (undos.length > 0) {
        const lastBatch = undos[undos.length - 1]
        if (lastBatch.patches.undo.length > 0) {
          change$.next({
            type: 'undo',
            patches: lastBatch.patches.undo,
            timestamp: lastBatch.timestamp
          })
          change$.next({type: 'selection',  selection: lastBatch.selection.undo})
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
          const {patches, selection} = toPatches(editor, lastBatch.operations, true)
          change$.next({
            type: 'redo',
            patches,
            timestamp: lastBatch.timestamp
          })
          change$.next({type: 'selection', selection})
        }
        editor.history.undos.push(lastBatch)
        editor.history.redos.pop()
      }
    }

    // Plugin return
    return editor
  }
}

// Helper functions for editor.apply above

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
