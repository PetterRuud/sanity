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
  change$: Subject<EditorChange>
  maxBlocks?: number
  hotkeys?: {marks: {}},
  searchAndReplace?: boolean
}

const NOOPPlugin = (editor: Editor) => {
  return editor
}

/**
 * Creates a new Portable Text Editor (which can be used without React)
 */
export function createPortableTextEditor(options: Options) {
  const {portableTextFeatures, keyGenerator, change$, maxBlocks, searchAndReplace} = options
  const withObjectKeys = createWithObjectKeys(portableTextFeatures, keyGenerator)
  const withScemaTypes = createWithSchemaTypes(portableTextFeatures)
  const operationToPatches = createOperationToPatches(portableTextFeatures)
  const withPatches = createWithPatches(operationToPatches, change$, portableTextFeatures)
  const withMaxBlocks = maxBlocks ? createWithMaxBlocks(maxBlocks) : NOOPPlugin
  const withPortableTextLists = createWithPortableTextLists(portableTextFeatures)
  const withHotkeys = createWithHotkeys(options.hotkeys, searchAndReplace)
  return withPatches(
    withHistory(
      withHotkeys(
        withPortableTextLists(
          withPortableTextMarkModel(withObjectKeys(withScemaTypes(withMaxBlocks(createEditor()))))
        )
      )
    )
  )
}
