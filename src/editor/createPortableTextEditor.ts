import {createEditor, Editor} from 'slate'
import {
  createWithObjectKeys,
  withPortableTextMarkModel,
  createWithSchemaTypes,
  createWithPatches,
  createWithMaxBlocks,
  createWithPortableTextLists,
  createWithHotkeys,
  createWithUndoRedo
} from './plugins'
import {PortableTextFeatures} from '../types/portableText'
import {createOperationToPatches} from '../utils/operationToPatches'
import {Subject} from 'rxjs'
import {EditorChange} from 'src/types/editor'
import {Patch} from 'src/types/patch'

type Options = {
  portableTextFeatures: PortableTextFeatures
  keyGenerator: () => string
  change$: Subject<EditorChange>
  maxBlocks?: number
  hotkeys?: {marks: {}}
  incomingPatche$?: Subject<Patch>
}

const NOOPPlugin = (editor: Editor) => {
  return editor
}

/**
 * Creates a new Portable Text Editor (which can be used without React)
 */
export function createPortableTextEditor(options: Options) {
  // TODO: mot so many options, but read more from schema?
  const {portableTextFeatures, keyGenerator, change$, maxBlocks, incomingPatche$} = options
  const withObjectKeys = createWithObjectKeys(portableTextFeatures, keyGenerator)
  const withScemaTypes = createWithSchemaTypes(portableTextFeatures)
  const operationToPatches = createOperationToPatches(portableTextFeatures)
  const withPatches = createWithPatches(operationToPatches, change$, portableTextFeatures, incomingPatche$)
  const withMaxBlocks = maxBlocks ? createWithMaxBlocks(maxBlocks) : NOOPPlugin
  const withPortableTextLists = createWithPortableTextLists(portableTextFeatures)
  const withHotkeys = createWithHotkeys(options.hotkeys, options.change$, portableTextFeatures)
  const withUndoRedo = createWithUndoRedo(operationToPatches, change$, portableTextFeatures, keyGenerator, incomingPatche$)

  return withPatches(
    withUndoRedo(
      withHotkeys(
        withPortableTextLists(
          withPortableTextMarkModel(withObjectKeys(withScemaTypes(withMaxBlocks(createEditor()))))
        )
      )
    )
  )
}
