import {createEditor, Editor} from 'slate'
import {
  createWithObjectKeys,
  createWithPortableTextMarkModel,
  createWithSchemaTypes,
  createWithPatches,
  createWithMaxBlocks,
  createWithPortableTextLists,
  createWithHotkeys,
  createWithUndoRedo,
  createWithPortableTextBlockStyle
} from './plugins'
import {PortableTextFeatures} from '../types/portableText'
import {createOperationToPatches} from '../utils/operationToPatches'
import {Subject} from 'rxjs'
import {EditorChange, PatchObservable} from 'src/types/editor'

type Options = {
  portableTextFeatures: PortableTextFeatures
  keyGenerator: () => string
  change$: Subject<EditorChange>
  maxBlocks?: number
  hotkeys?: {marks: {}}
  incomingPatche$?: PatchObservable
}

// This is the signature of a minimal Slate plugin
const NOOPPlugin = (editor: Editor) => {
  // Do some transformations here
  return editor
}

/**
 * Creates a new Portable Text Editor (which can be used without React)
 */
export function createPortableTextEditor(options: Options) {
  const {portableTextFeatures, keyGenerator, change$, maxBlocks, incomingPatche$} = options
  const operationToPatches = createOperationToPatches(portableTextFeatures)
  const withObjectKeys = createWithObjectKeys(portableTextFeatures, keyGenerator)
  const withScemaTypes = createWithSchemaTypes(portableTextFeatures)
  const withPatches = createWithPatches(
    operationToPatches,
    change$,
    portableTextFeatures,
    incomingPatche$
  )
  const withMaxBlocks = maxBlocks ? createWithMaxBlocks(maxBlocks) : NOOPPlugin
  const withPortableTextLists = createWithPortableTextLists(portableTextFeatures, change$)
  const withHotkeys = createWithHotkeys(options.hotkeys, options.change$, portableTextFeatures)
  const withUndoRedo = createWithUndoRedo(incomingPatche$)
  const withPortableTextMarkModel = createWithPortableTextMarkModel(change$)
  const withPortableTextBlockStyle = createWithPortableTextBlockStyle(portableTextFeatures, change$)

  return withPatches(
    withUndoRedo(
      withHotkeys(
        withPortableTextBlockStyle(
          withPortableTextLists(
            withPortableTextMarkModel(withObjectKeys(withScemaTypes(withMaxBlocks(createEditor()))))
          )
        )
      )
    )
  )
}
