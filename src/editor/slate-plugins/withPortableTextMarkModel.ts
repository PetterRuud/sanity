import {Editor, Range, Transforms, Text, Path} from 'slate'
import {isEqual, flatten} from 'lodash'

/**
 *
 * This plugin will replace Slate's default marks model with the Portable Text one.
 * A side effect of this is that siblings with the same set of marks escapes the
 * Slate default-normalization. We must therefor do it ourselves (see normalizeSimilarSiblings)
 */
export function withPortableTextMarkModel(editor: Editor) {
  // Merge spans with same set of .marks when doing merge_node operations
  const {normalizeNode} = editor
  editor.normalizeNode = nodeEntry => {
    normalizeNode(nodeEntry)
    if (editor.operations.some(op => op.type === 'merge_node')) {
      mergeSpans(editor)
    }
  }

  editor.addMark = (mark: string) => {
    if (editor.selection) {
      if (Range.isExpanded(editor.selection)) {
        // Split if needed
        Transforms.setNodes(editor, {}, {match: Text.isText, split: true})
        // Use new selection
        const splitTextNodes = [...Editor.nodes(editor, {at: editor.selection, match: Text.isText})]
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
        editor.onChange()
      }
    }
  }
  editor.removeMark = (mark: string) => {
    if (editor.selection) {
      if (Range.isExpanded(editor.selection)) {
        // Split if needed
        Transforms.setNodes(editor, {}, {match: Text.isText, split: true})
        const splitTextNodes = [...Editor.nodes(editor, {at: editor.selection, match: Text.isText})]
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
        editor.onChange()
      }
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
        Transforms.mergeNodes(editor, { at: nextPath, voids: true })
      }
    }
  }
}
