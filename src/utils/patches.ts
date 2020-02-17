import {Patch} from '../types/patch'

/**
 * Try to compact a set of patches
 *
 */
export function compactPatches(patches: Patch[]) {
  // If the last patch is unsetting everything, just do that
  const lastPatch = patches.slice(-1)[0]
  if (lastPatch && lastPatch.type === 'unset' && lastPatch.path.length === 0) {
    return [lastPatch]
  }
  return patches
}
