import {createEditor, Editor} from 'slate'
import {withHistory} from 'slate-history'
import {
  createWithObjectKeys,
  withPortableTextMarkModel,
  createWithSchemaTypes,
  createWithPatches,
  createWithMaxBlocks,
  createWithPortableTextLists,
  createWithHotkeys
} from './slate-plugins'
import {PortableTextFeatures} from '../types/portableText'
import {createOperationToPatches} from '../utils/operationToPatches'
import {Subject} from 'rxjs'
import {EditorChange} from 'src/types/editor'

type Options = {
  portableTextFeatures: PortableTextFeatures
  keyGenerator: () => string
  changes: Subject<EditorChange>
  maxBlocks?: number
  hotkeys?: {marks: {}}
}

const NOOPPlugin = (editor: Editor) => {
  return editor
}

/**
 * Creates a new Portable Text Editor (which can be used without React)
 */
export function createPortableTextEditor(options: Options) {
  const {portableTextFeatures, keyGenerator, changes} = options
  const withObjectKeys = createWithObjectKeys(portableTextFeatures, keyGenerator)
  const withScemaTypes = createWithSchemaTypes(portableTextFeatures)
  const operationToPatches = createOperationToPatches(portableTextFeatures)
  const withPatches = createWithPatches(operationToPatches, changes, portableTextFeatures)
  const withMaxBlocks = options.maxBlocks ? createWithMaxBlocks(options.maxBlocks) : NOOPPlugin
  const withPortableTextLists = createWithPortableTextLists(portableTextFeatures)
  const withHotkeys = createWithHotkeys(options.hotkeys)
  return withPatches(
    withMaxBlocks(
      withHistory(
        withHotkeys(
          withPortableTextLists(
            withPortableTextMarkModel(withObjectKeys(withScemaTypes(createEditor())))
          )
        )
      )
    )
  )
}
