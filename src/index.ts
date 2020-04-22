import {randomKey} from './utils/randomKey'
export {PortableTextEditor} from './editor/PortableTextEditor'
export * from './types/editor'
export * from './types/portableText'
export * from './types/schema'
export {compactPatches} from './utils/patches'
export {Patch} from './types/patch'
export function keyGenerator() {
  return randomKey(12)
}
