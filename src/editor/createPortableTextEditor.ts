import {createEditor} from 'slate'
import {withHistory} from 'slate-history'
import {
  createWithKeys,
  createWithPortableTextMarkModel,
  // createWithPlaceholderBlock,
  createWithSchemaTypes,
  createWithPatches
} from './slate-plugins'
import {PortableTextFeatures} from 'src/types/portableText'
import {Patch} from 'src/types/patch'
import {createOperationToPatches} from '../utils/operationToPatches'
import {Subject} from 'rxjs'
import {Editor} from 'slate'

type Options = {
  portableTextFeatures: PortableTextFeatures
  keyGenerator: () => string
  patchSubject: Subject<{patches: Patch[]; editor: Editor}>
}

/**
 * Creates a new pure Portable Text Editor (which can be used without React)
 */
export function createPortableTextEditor(options: Options) {
  const {portableTextFeatures, keyGenerator, patchSubject} = options
  const withKeys = createWithKeys(portableTextFeatures, keyGenerator)
  const withPortableTextMarkModel = createWithPortableTextMarkModel()
  const withScemaTypes = createWithSchemaTypes(portableTextFeatures)
  const operationToPatches = createOperationToPatches(portableTextFeatures)
  const withPatches = createWithPatches(operationToPatches, patchSubject)
  // const withPlaceholderBlock = createWithPlaceholderBlock(portableTextFeatures, keyGenerator)
  return withHistory(
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
}
