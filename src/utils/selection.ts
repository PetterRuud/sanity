import {Editor, Point, Node, Location, Path} from 'slate'
import {EditorSelection} from '../types/editor'

function createKeyedPath(point: Point, editor: Editor) {
  const first = {_key: editor.children[point.path[0]]._key}
  let second: any = point.path[1]
  if (second !== undefined) {
    second = {_key: editor.children[point.path[0]].children[second]._key}
  }
  return second ? [first, 'children', second] : [first]
}

function createArrayedPath(point: any, nodes: Node[] | undefined): Path {
  if (!nodes) {
    return []
  }
  const first = nodes.findIndex(blk => blk._key === point.path[0]._key)
  let second: any
  if (point.path[2]) {
    const blk =  nodes.find(item => item._key === point.path[0]._key)
    if (blk) {
      second = blk.children.findIndex(child => child._key === point.path[2]._key)
    }
  }
 return second !== undefined ? [first, second] : [first]
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

export function toSlateRange(selection: EditorSelection, nodes: Node[] | undefined): Location | null {
  if (!selection || !nodes) {
    return null
  }
  const anchor = {
    path: createArrayedPath(selection.anchor, nodes),
    offset: selection.anchor.offset
  }
  const focus = {
    path: createArrayedPath(selection.focus, nodes),
    offset: selection.focus.offset
  }
  const range = {anchor, focus}
  return range
}
