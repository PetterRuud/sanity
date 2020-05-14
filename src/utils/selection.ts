import {Editor, Point, Path as SlatePath, Range, Element} from 'slate'
import {EditorSelection, EditorSelectionPoint} from '../types/editor'
import {PortableTextBlock} from 'src/types/portableText'
import {isEqual} from 'lodash'

export function createKeyedPath(point: Point, editor: Editor) {
  let blockPath = [point.path[0]]
  const [block] = Editor.node(editor, blockPath, {depth: 1})
  if (!block || !Element.isElement(block)) {
    return null
  }
  const keyedBlockPath = [{_key: block._key}]
  if (editor.isVoid(block)) {
    return keyedBlockPath
  }
  let keyedChildPath
  const childPath = point.path.slice(0, 2)
  if (childPath) {
    const [child] = Editor.node(editor, childPath, {depth: 2})
    keyedChildPath = ['children', {_key: child._key}]
  }
  return keyedChildPath ? [...keyedBlockPath, ...keyedChildPath] : keyedBlockPath
}

export function createArrayedPath(point: EditorSelectionPoint, editor: Editor): SlatePath {
  if (!editor) {
    return []
  }
  const [block, blockPath] = Array.from(
    Editor.nodes(editor, {at: [], match: n => n._key === point.path[0]['_key']})
  )[0]
  if (!block || !Element.isElement(block)) {
    return []
  }
  if (editor.isVoid(block)) {
    return blockPath
  }
  const childPath = [point.path[2]]
  const childIndex = block.children.findIndex(child => isEqual([{_key: child._key}], childPath))
  if (childIndex >= 0 && block.children[childIndex]) {
    const child = block.children[childIndex]
    if (Element.isElement(child) && editor.isVoid(child)) {
      return blockPath.concat(childIndex).concat(0)
    }
    return blockPath.concat(childIndex)
  }
  return blockPath
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

export function toPortableTextRange(editor: Editor): EditorSelection | null {
  if (!editor.selection) {
    return editor.selection
  }
  let anchor
  let focus
  const anchorPath = createKeyedPath(editor.selection.anchor, editor)
  if (anchorPath) {
    anchor = {
      path: createKeyedPath(editor.selection.anchor, editor),
      offset: editor.selection.anchor.offset
    }
  }
  const focusPath = createKeyedPath(editor.selection.focus, editor)
  if (focusPath) {
    focus = {
      path: createKeyedPath(editor.selection.focus, editor),
      offset: editor.selection.focus.offset
    }
  }
  const range = anchor && focus ? {anchor, focus} : null
  return range
}

export function toSlateRange(selection: EditorSelection, editor: Editor): Range | null {
  if (!selection || !editor) {
    return null
  }
  const anchor = {
    path: createArrayedPath(selection.anchor, editor),
    offset: selection.anchor.offset
  }
  const focus = {
    path: createArrayedPath(selection.focus, editor),
    offset: selection.focus.offset
  }
  const range = anchor && focus ? {anchor, focus} : null
  return range
}
