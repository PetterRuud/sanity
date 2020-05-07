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
  createWithPortableTextBlockStyle,
  createWithUtils
} from './plugins'
import {createOperationToPatches} from '../utils/operationToPatches'
import {Options} from '../types/options'

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
  const withHotkeys = createWithHotkeys(options.hotkeys)
  const withUndoRedo = createWithUndoRedo(incomingPatche$)
  const withPortableTextMarkModel = createWithPortableTextMarkModel(change$)
  const withPortableTextBlockStyle = createWithPortableTextBlockStyle(portableTextFeatures, change$)
  const withUtils = createWithUtils(portableTextFeatures)

  return withPatches(
    withUndoRedo(
      withHotkeys(
        withUtils(
          withPortableTextBlockStyle(
            withPortableTextLists(
              withPortableTextMarkModel(withObjectKeys(withScemaTypes(withMaxBlocks(createEditor()))))
            )
          )
        )
      )
    )
  )
}
