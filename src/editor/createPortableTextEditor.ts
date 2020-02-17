import {createEditor, Editor} from 'slate'
import {withHistory} from 'slate-history'
import {
  createWithKeys,
  withPortableTextMarkModel,
  createWithSchemaTypes,
  createWithPatches,
  createWithMaxBlocks,
  createWithPortableTextLists,
  createWithHotkeys
} from './slate-plugins'
import {PortableTextFeatures} from 'src/types/portableText'
import {Patch} from 'src/types/patch'
import {createOperationToPatches} from '../utils/operationToPatches'
import {Subject} from 'rxjs'

type Options = {
  portableTextFeatures: PortableTextFeatures
  keyGenerator: () => string
  patchSubject: Subject<{patches: Patch[]; editor: Editor}>
  maxBlocks?: number,
  hotkeys?: {marks: {}}
}

const NOOPPlugin = (editor: Editor) => {
  return editor
}

/**
 * Creates a new Portable Text Editor (which can be used without React)
 */
export function createPortableTextEditor(options: Options) {
  const {portableTextFeatures, keyGenerator, patchSubject} = options
  const withKeys = createWithKeys(portableTextFeatures, keyGenerator)
  const withScemaTypes = createWithSchemaTypes(portableTextFeatures)
  const operationToPatches = createOperationToPatches(portableTextFeatures)
  const withPatches = createWithPatches(operationToPatches, patchSubject, portableTextFeatures)
  const withMaxBlocks = options.maxBlocks ? createWithMaxBlocks(options.maxBlocks) : NOOPPlugin
  const withPortableTextLists = createWithPortableTextLists(portableTextFeatures)
  const withHotkeys = createWithHotkeys(options.hotkeys)
  return withMaxBlocks(
    withHistory(
      withHotkeys(
        withPatches(
          withPortableTextLists(
            withPortableTextMarkModel(
              withKeys(
                withScemaTypes(
                  createEditor()
                )
              )
            )
          )
        )
      )
    )
  )
}
