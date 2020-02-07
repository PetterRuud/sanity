import {createEditor, Editor} from 'slate'
import {withHistory} from 'slate-history'
import {
  createWithKeys,
  withPortableTextMarkModel,
  // createWithPlaceholderBlock,
  createWithSchemaTypes,
  createWithPatches,
  createWithMaxBlocks
} from './slate-plugins'
import {PortableTextFeatures} from 'src/types/portableText'
import {Patch} from 'src/types/patch'
import {createOperationToPatches} from '../utils/operationToPatches'
import {Subject} from 'rxjs'

type Options = {
  portableTextFeatures: PortableTextFeatures
  keyGenerator: () => string
  patchSubject: Subject<{patches: Patch[]; editor: Editor}>
  maxBlocks?: number
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
  const withPatches = createWithPatches(operationToPatches, patchSubject)
  const withMaxBlocks = options.maxBlocks ? createWithMaxBlocks(options.maxBlocks) : NOOPPlugin
  // const withPlaceholderBlock = createWithPlaceholderBlock(portableTextFeatures, keyGenerator)
  return withMaxBlocks(
    withHistory(
      withPatches(
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
}
