import {Editor, Point, Path as SlatePath, Range} from 'slate'
import {EditorSelection, EditorSelectionPoint} from '../types/editor'
import {PortableTextBlock} from 'src/types/portableText'
import {isEqual} from 'lodash'

function createKeyedPath(point: Point, editor: Editor) {
  const first = {_key: editor.children[point.path[0]]._key}
  let second: any = point.path[1]
  if (second !== undefined) {
    second = {_key: editor.children[point.path[0]].children[second]._key}
  }
  return second ? [first, 'children', second] : [first]
}

function createArrayedPath(
  point: EditorSelectionPoint,
  value: PortableTextBlock[] | undefined
): SlatePath {
  if (!value) {
    return []
  }
  const first = value.findIndex(blk => blk._key === point.path[0]['_key'])
  let second: any
  if (point.path[2]) {
    const blk = value.find(item => item._key === point.path[0]['_key'])
    if (blk) {
      second = blk.children.findIndex(child => child._key === point.path[2]['_key'])
    }
  }
  return second !== undefined ? [first, second] : [first]
}

function normalizePoint(point: EditorSelectionPoint, value: PortableTextBlock[]) {
  if (!point || !value) {
    return null
  }
  const newPath: any = []
  let newOffset: number = point.offset || 0
  const block: PortableTextBlock | undefined = value.find(blk => blk._key === point.path[0]['_key'])
  if (block) {
    newPath.push({_key: block._key})
  } else {
    return null
  }
  if (block && point.path[1] === 'children') {
    if (!block.children || block.children.length === 0) {
      return null
    }
    const child = block.children.find(cld => cld._key === point.path[2]['_key'])
    if (child) {
      newPath.push('children')
      newPath.push({_key: child._key})
      newOffset = child.text && child.text.length >= point.offset ? point.offset : child.text.length
    } else {
      return null
    }
  }
  return {path: newPath, offset: newOffset}
}

export function normalizeSelection(
  selection: EditorSelection,
  value: PortableTextBlock[] | undefined
) {
  if (!selection || !value || value.length === 0) {
    return null
  }
  let newAnchor: EditorSelectionPoint | null = null
  let newFocus: EditorSelectionPoint | null = null
  const {anchor, focus} = selection
  if (anchor && value.find(blk => isEqual({_key: blk._key}, anchor.path[0]))) {
    newAnchor = normalizePoint(anchor, value)
  }
  if (focus && value.find(blk => isEqual({_key: blk._key}, focus.path[0]))) {
    newFocus = normalizePoint(focus, value)
  }
  if (newAnchor && newFocus) {
    return {anchor: newAnchor, focus: newFocus}
  }
  return null
}

export function toPortableTextRange(editor: Editor) {
  if (!editor.selection) {
    return editor.selection
  }
  const anchor = {
    path: createKeyedPath(editor.selection.anchor, editor),
    offset: editor.selection.anchor.offset
  }
  const focus = {
    path: createKeyedPath(editor.selection.focus, editor),
    offset: editor.selection.focus.offset
  }
  const range = {anchor, focus}
  return range
}

export function toSlateRange(
  selection: EditorSelection,
  value: PortableTextBlock[] | undefined
): Range | null {
  if (!selection || !value) {
    return null
  }
  const anchor = {
    path: createArrayedPath(selection.anchor, value),
    offset: selection.anchor.offset
  }
  const focus = {
    path: createArrayedPath(selection.focus, value),
    offset: selection.focus.offset
  }
  const range = anchor && focus ? {anchor, focus} : null
  return range
}
