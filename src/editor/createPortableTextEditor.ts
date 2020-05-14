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
import {createEditorOptions} from '../types/options'
import {debugWithName} from '../utils/debug'

const debug = debugWithName('createPortableTextEditor')

const disablePlugin = (name: string): ((editor: Editor) => Editor) => {
  debug(`Editor plugin '${name}' is disabled`)
  // This is the signature of a minimal Slate plugin
  return (editor: Editor) => {
    // Do some transformations here
    return editor
  }
}

/**
 * Creates a new Portable Text Editor (which can be used without React)
 * TODO: Clean up the options here when stable. 2020-05-10
 */
export function createPortableTextEditor(options: createEditorOptions) {
  const {
    portableTextFeatures,
    keyGenerator,
    change$,
    maxBlocks,
    incomingPatche$,
    setMustAdjustSelection,
    readOnly
  } = options
  const operationToPatches = createOperationToPatches(portableTextFeatures)
  const withObjectKeys = createWithObjectKeys(portableTextFeatures, keyGenerator)
  const withScemaTypes = createWithSchemaTypes(portableTextFeatures)
  const withPatches = readOnly
    ? disablePlugin('withPatches')
    : createWithPatches(
        operationToPatches,
        change$,
        portableTextFeatures,
        setMustAdjustSelection,
        incomingPatche$
      )

  const withMaxBlocks = maxBlocks ? createWithMaxBlocks(maxBlocks) : disablePlugin('withMaxBlocks')
  const withPortableTextLists = createWithPortableTextLists(portableTextFeatures, change$)
  const withHotkeys = createWithHotkeys(options.hotkeys)
  const withUndoRedo = readOnly
    ? disablePlugin('withUndoRedo')
    : createWithUndoRedo(incomingPatche$)
  const withPortableTextMarkModel = createWithPortableTextMarkModel(portableTextFeatures, change$)
  const withPortableTextBlockStyle = createWithPortableTextBlockStyle(portableTextFeatures, change$)
  const withUtils = createWithUtils(portableTextFeatures)

  return withPatches(
    withUndoRedo(
      withHotkeys(
        withUtils(
          withPortableTextBlockStyle(
            withPortableTextLists(
              withPortableTextMarkModel(
                withObjectKeys(withScemaTypes(withMaxBlocks(createEditor())))
              )
            )
          )
        )
      )
    )
  )
}
