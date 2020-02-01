import {createEditor} from 'slate'
import {withHistory} from 'slate-history'
import {
  normalizeAsPortableText,
  createWithKeys,
  createWithPortableTextMarkModel,
  createEnsurePlaceHolderBlock
} from './slate-plugins'
import {PortableTextFeatures} from 'src/types/portableText'

/**
 * Creates a new pure Portable Text Editor (which can be used without React)
 */
export function createPortableTextEditor(portableTextFeatures: PortableTextFeatures, keyGenerator: () => string) {
  const withNormalizeAsPortableText = normalizeAsPortableText(portableTextFeatures, keyGenerator)
  const withKeys = createWithKeys(keyGenerator)
  const withPortableTextMarkModel = createWithPortableTextMarkModel()
  const ensurePlaceHolderBlock = createEnsurePlaceHolderBlock(portableTextFeatures, keyGenerator)
  return withHistory(withNormalizeAsPortableText(withPortableTextMarkModel(withKeys(ensurePlaceHolderBlock(createEditor())))))
}
