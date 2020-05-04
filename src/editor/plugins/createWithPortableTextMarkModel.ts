/**
 *
 * This plugin will change Slate's default marks model (every prop is a mark) with the Portable Text model (marks is an array of strings on prop .marks).
 */

 import {Editor, Range, Transforms, Text, Path, NodeEntry} from 'slate'
import {isEqual, flatten} from 'lodash'
import {Subject} from 'rxjs'

import {debugWithName} from '../../utils/debug'
import {EditorChange} from '../../types/editor'
import {toPortableTextRange} from '../../utils/selection'

const debug = debugWithName('plugin:withPortableTextMarkModel')

export function createWithPortableTextMarkModel(change$: Subject<EditorChange>) {
  return function withPortableTextMarkModel(editor: Editor) {


    // Extend Slate's default normalization. Merge spans with same set of .marks when doing merge_node operations
    const {normalizeNode} = editor
    editor.normalizeNode = nodeEntry => {
      normalizeNode(nodeEntry)
      if (editor.operations.some(op => op.type === 'merge_node')) {
        mergeSpans(editor)
      }
    }

    // Override built in addMark function
    editor.addMark = (mark: string) => {
      if (editor.selection) {
        if (Range.isExpanded(editor.selection)) {
          // Split if needed
          Transforms.setNodes(editor, {}, {match: Text.isText, split: true})
          // Use new selection
          const splitTextNodes = [
            ...Editor.nodes(editor, {at: editor.selection, match: Text.isText})
          ]
          const shouldRemoveMark = flatten(
            splitTextNodes.map(item => item[0]).map(node => node.marks)
          ).includes(mark)
          if (shouldRemoveMark) {
            editor.removeMark(mark)
            return
          }
          splitTextNodes.forEach(([node, path]) => {
            const marks = [...(node.marks || []).filter((eMark: string) => eMark !== mark), mark]
            Transforms.setNodes(editor, {marks}, {at: path})
          })
          mergeSpans(editor)
        } else {
          const existingMarks: string[] =
            {
              ...(Editor.marks(editor) || {})
            }.marks || []
          const marks = {
            ...(Editor.marks(editor) || {}),
            marks: [...existingMarks, mark]
          }
          editor.marks = marks
        }
        editor.onChange()
      }
    }

    // Override built in removeMark function
    editor.removeMark = (mark: string) => {
      if (editor.selection) {
        if (Range.isExpanded(editor.selection)) {
          // Split if needed
          Transforms.setNodes(editor, {}, {match: Text.isText, split: true})
          const splitTextNodes = [
            ...Editor.nodes(editor, {at: editor.selection, match: Text.isText})
          ]
          splitTextNodes.forEach(([node, path]) => {
            Transforms.setNodes(
              editor,
              {marks: (node.marks || []).filter((eMark: string) => eMark !== mark)},
              {at: path}
            )
          })
          mergeSpans(editor)
        } else {
          const existingMarks: string[] =
            {
              ...(Editor.marks(editor) || {})
            }.marks || []
          const marks = {
            ...(Editor.marks(editor) || {}),
            marks: existingMarks.filter(eMark => eMark !== mark)
          }
          editor.marks = marks
        }
        editor.onChange()
      }
    }

    editor.pteIsMarkActive = (mark: string) => {
      if (!editor.selection) {
        return null
      }
      let existingMarks
      if (Range.isExpanded(editor.selection)) {
        const [match] = Editor.nodes(editor, {match: Text.isText})

        if (match) {
          const [node] = match as NodeEntry<Text>
          existingMarks = node.marks
        } else {
          existingMarks = []
        }
      } else {
        const {anchor} = editor.selection
        const {path} = anchor
        let [node] = Editor.leaf(editor, path)

        if (anchor.offset === 0) {
          const prev = Editor.previous(editor, {at: path, match: Text.isText})
          const block = Editor.above(editor, {
            match: n => Editor.isBlock(editor, n)
          })

          if (prev && block) {
            const [prevNode, prevPath] = prev
            const [, blockPath] = block

            if (Path.isAncestor(blockPath, prevPath)) {
              node = prevNode as Text
            }
          }
        }
        existingMarks = node.marks
      }
      existingMarks =
        {
          ...(Editor.marks(editor) || {})
        }.marks || []
      return existingMarks ? existingMarks.includes(mark) : false
    }

    // Custom editor function to toggle a mark
    editor.pteToggleMark = (mark: string) => {
      const isActive = editor.pteIsMarkActive(mark)
      if (isActive) {
        debug(`Remove mark '${mark}'`)
        Editor.removeMark(editor, mark)
      } else {
        debug(`Add mark '${mark}'`)
        Editor.addMark(editor, mark, true)
      }
      const newSelection = toPortableTextRange(editor)
      if (newSelection !== undefined) {
        // Emit a new selection here (though it might be the same).
        // This is for toolbars etc that listens to selection changes to update themselves.
        change$.next({type: 'selection', selection: newSelection})
      }
    }
    return editor
  }

  /**
   * Normalize re-marked spans in selection
   *
   * @param {Editor} editor
   */
  function mergeSpans(editor: Editor) {
    const {selection} = editor
    if (selection) {
      for (const [node, path] of Array.from(
        Editor.nodes(editor, {
          at: Editor.range(editor, [selection.anchor.path[0]], [selection.focus.path[0]]),
          match: Text.isText
        })
      ).reverse()) {
        const [parent] = Editor.node(editor, Path.parent(path))
        const nextPath = [path[0], path[1] + 1]
        const nextTextNode = parent.children[nextPath[1]]
        if (nextTextNode && nextTextNode.text && isEqual(nextTextNode.marks, node.marks)) {
          Transforms.mergeNodes(editor, {at: nextPath, voids: true})
        }
      }
    }
  }
}
