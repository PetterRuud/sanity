import {createEditor, Editor} from 'slate'
// import {withHistory} from 'slate-history'
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
import {PortableTextFeatures, PortableTextBlock} from '../types/portableText'
import {createOperationToPatches} from '../utils/operationToPatches'
import {Subject} from 'rxjs'
import {EditorChange} from 'src/types/editor'

type Options = {
  portableTextFeatures: PortableTextFeatures
  keyGenerator: () => string
  change$: Subject<EditorChange>
  maxBlocks?: number
  hotkeys?: {marks: {}}
  searchAndReplace?: boolean
  singleUserUndoRedo?: boolean,
  createPlaceHolderBlock: () => PortableTextBlock
}

const NOOPPlugin = (editor: Editor) => {
  return editor
}

/**
 * Creates a new Portable Text Editor (which can be used without React)
 */
export function createPortableTextEditor(options: Options) {
  const {portableTextFeatures, keyGenerator, change$, maxBlocks, searchAndReplace, createPlaceHolderBlock} = options
  const withObjectKeys = createWithObjectKeys(portableTextFeatures, keyGenerator)
  const withScemaTypes = createWithSchemaTypes(portableTextFeatures)
  const operationToPatches = createOperationToPatches(portableTextFeatures)
  const withPatches = createWithPatches(operationToPatches, change$, portableTextFeatures, createPlaceHolderBlock)
  const withMaxBlocks = maxBlocks ? createWithMaxBlocks(maxBlocks) : NOOPPlugin
  const withPortableTextLists = createWithPortableTextLists(portableTextFeatures)
  const withHotkeys = createWithHotkeys(options.hotkeys, searchAndReplace)
  // const withOptionalHistory = options.singleUserUndoRedo ? withHistory : NOOPPlugin
  const withUndoRedo = createWithUndoRedo(operationToPatches, change$, portableTextFeatures, keyGenerator)
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
