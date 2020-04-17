import {Subject} from 'rxjs'
import {isEqual, flatten} from 'lodash'
import {Editor, Operation, Path, createEditor, Transforms} from 'slate'
import {Patch} from '../../types/patch'
import {EditorChange, EditorSelection, PatchObservable} from 'src/types/editor'
import {toPortableTextRange} from '../../utils/selection'
import {createWithObjectKeys} from '.'
import {PortableTextFeatures} from '../../types/portableText'
import {setIfMissing} from '../../patch/PatchEvent'
import {isEqualToEmptyEditor, fromSlateValue} from '../../utils/values'
import * as DMP from 'diff-match-patch'

const dmp = new DMP.diff_match_patch()
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
  keyGenerator: () => string,
  incomingPatche$?: PatchObservable
) {
  // A temporary editor to produce undo/redo patches on without interfering with the user editor
  const dummyEditor = createWithObjectKeys(portableTextFeatures, keyGenerator)(createEditor())

  // Subscribe to incoming patches
  const incomingPatches: {patch: Patch; time: Date}[] = []
  if (incomingPatche$) {
    incomingPatche$.subscribe(patch => {
      incomingPatches.push({patch: patch, time: new Date()})
    })
  }

  function toPatches(editor, operations, isRedo) {
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
    return {patches, selection: isRedo ? redoSelection : toPortableTextRange(dummyEditor)}
  }
  return (editor: Editor) => {
    editor.history = {undos: [], redos: []}
    const {apply} = editor
    // Apply function for merging and saving local history inspired from 'slate-history' by Ian Storm Taylor
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
            timestamp: new Date()
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
      if (lastBatch) {
        lastBatch.redoSelection = toPortableTextRange(editor)
      }
    }

    editor.undo = () => {
      const {undos} = editor.history
      if (undos.length > 0) {
        const lastBatch = undos[undos.length - 1]
        if (lastBatch.operations.length > 0) {
          const otherPatches = [...incomingPatches.filter(item => item.time > lastBatch.timestamp)]
          let transformedOperations = lastBatch.operations
          otherPatches.forEach(item => {
            transformedOperations = flatten(
              transformedOperations.map(op => transformOperation(editor, item.patch, op))
            )
          })
          const {patches, selection} = toPatches(editor, transformedOperations, false)
          if (isEqualToEmptyEditor(editor.children, portableTextFeatures)) {
            const prevValue = fromSlateValue(editor.children, portableTextFeatures.types.block.name)
            patches.unshift(setIfMissing(prevValue, []))
          }
          change$.next({
            type: 'undo',
            patches,
            timestamp: lastBatch.timestamp
          })
          if (!isEqualToEmptyEditor(editor.children, portableTextFeatures)) {
            change$.next({type: 'selection', selection})
          }
        }
        editor.history.redos.push(lastBatch)
        editor.history.undos.pop()
      }
    }

    editor.redo = () => {
      const {redos} = editor.history
      if (redos.length > 0) {
        const lastBatch = redos[redos.length - 1]
        if (lastBatch.operations.length > 0) {
          const otherPatches = incomingPatches.filter(item => item.time > lastBatch.timestamp)
          let transformedOperations = lastBatch.operations
          otherPatches.forEach(item => {
            transformedOperations = flatten(
              transformedOperations.map(op => transformOperation(editor, item.patch, op))
            )
          })
          const {patches, selection} = toPatches(editor, transformedOperations, true)
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

function transformOperation(editor: Editor, patch: Patch, operation: Operation): Operation[] {
  let transformedOperation = {...operation}
  if (patch.type === 'insert' && patch.path.length === 1) {
    return [adjustBlockPath(editor, patch, operation, patch.items.length)]
  }
  if (patch.type === 'unset' && patch.path.length === 1) {
    return [adjustBlockPath(editor, patch, operation, -1)]
  }

  // Someone reset the whole value
  if (patch.type === 'unset' && patch.path.length === 0) {
    return []
  }

  if (patch.type === 'diffMatchPatch') {
    const blockIndex = editor.children.findIndex(blk => isEqual({_key: blk._key}, patch.path[0]))
    const block = editor.children[blockIndex]
    if (block) {
      const childIndex = block.children.findIndex(child =>
        isEqual({_key: child._key}, patch.path[2])
      )
      const parsed = dmp.patch_fromText(patch.value)[0]
      if (!parsed) {
        return [operation]
      }
      const distance = parsed.length2 - parsed.length1
      const patchIsRemovingText = parsed.diffs.some(diff => diff[0] === -1)
      if (
        operation.path &&
        operation.path[0] !== undefined &&
        operation.path[0] === blockIndex &&
        operation.path[1] === childIndex
      ) {
        if (operation.type === 'insert_text') {
          let insertOffset = 0
          for (const diff of parsed.diffs) {
            if (diff[0] === 0) {
              insertOffset = diff[1].length
            }
            if (diff[0] === 1) {
              break
            }
          }
          if (insertOffset + parsed.start1 <= operation.offset) {
            transformedOperation.offset = transformedOperation.offset + distance
          }
          return [transformedOperation]
        }

        if (operation.type === 'remove_text') {
          let insertOffset = 0
          for (const diff of parsed.diffs) {
            if (diff[0] === 0) {
              insertOffset = diff[1].length
            }
            if (diff[0] === -1) {
              break
            }
          }
          if (insertOffset + parsed.start1 <= operation.offset) {
            transformedOperation.offset = transformedOperation.offset - distance
          }
          return [transformedOperation]
        }
      }
      // Selection operations with diffPatchMatch
      if (operation.type === 'set_selection') {
        const newProperties = transformedOperation.newProperties
        if (newProperties && patchIsRemovingText) {
          newProperties.offset = newProperties.offset - distance
        } else if (newProperties) {
          newProperties.offset = newProperties.offset + distance
        }
        return [newProperties ? {...transformedOperation, newProperties} : transformedOperation]
      }
    }
    // TODO: transform this?
    // if (operation.type === 'set_selection' && patch.type !== 'diffMatchPatch') {
    //   console.log('set_selection other', JSON.stringify(patch))
    // }
  }
  return [operation]
}

function adjustBlockPath(editor, patch, operation, level): Operation {
  const transformedOperation = {...operation}
  const myIndex = editor.children.findIndex(blk => isEqual({_key: blk._key}, patch.path[0]))
  // console.log('old operation', JSON.stringify(operation))
  if (
    myIndex >= 0 &&
    operation.path &&
    operation.path[0] !== undefined &&
    operation.path[0] >= myIndex + level
  ) {
    transformedOperation.path = [operation.path[0] + level, ...operation.path.slice(1)]
  }
  // console.log('New operation', JSON.stringify(transformedOperation))
  return transformedOperation
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
