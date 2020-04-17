import * as DMP from 'diff-match-patch'

import {
  SetIfMissingPatch,
  InsertPatch,
  InsertPosition,
  SetPatch,
  UnsetPatch,
  DiffMatchPatch
} from '../types/patch'
import {Path, PathSegment} from '../types/path'

export function setIfMissing(value: any, path: Path = []): SetIfMissingPatch {
  return {
    type: 'setIfMissing',
    path,
    value
  }
}

const dmp = new DMP.diff_match_patch()

export function diffMatchPatch(currentValue: string, nextValue: string, path: Path = []): DiffMatchPatch {
  const patch = dmp
    .patch_make(currentValue, nextValue)
    .map(patch => patch.toString())
    .join('')
  return {type: 'diffMatchPatch', path, value: patch}
}

export function insert(items: any[], position: InsertPosition, path: Path = []): InsertPatch {
  return {
    type: 'insert',
    path,
    position,
    items
  }
}

export function set(value: any, path: Path = []): SetPatch {
  return {type: 'set', path, value}
}

export function unset(path: Path = []): UnsetPatch {
  return {type: 'unset', path}
}

export function prefixPath<T extends {path: Path}>(patch: T, segment: PathSegment): T {
  return {
    ...patch,
    path: [segment, ...patch.path]
  }
}
