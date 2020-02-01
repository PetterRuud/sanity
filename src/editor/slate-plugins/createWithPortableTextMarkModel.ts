import {Editor, Range, Transforms, Text, Path} from 'slate'
import {isEqual, flatten} from 'lodash'
import { EditorOperation } from 'src/types/editor'

/**
 *
 * This plugin will replace Slate's default marks model with the Portable Text one.
 * A side effect of this is that siblings with the same set of marks escapes the
 * Slate default-normalization. We must therefor do it ourselves (see normalizeSimilarSiblings)
 */
export function createWithPortableTextMarkModel() {
  return function withPortableTextMarkModel(editor: Editor) {

    // Normalize after 'merge_node' operation
    const {apply} = editor
    editor.apply = (operation: EditorOperation) => {
      // const originalSelection = editor.selection
      apply(operation)
      if (operation.type === 'merge_node' && editor.selection) {
        const selection = Editor.range(editor, [editor.selection.anchor.path[0]], [editor.selection.focus.path[0]])
        normalizeSimilarSiblings(editor, selection)
        // TODO: Set back to original offset
        console.log('Should set back original offset')
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
            const marks = [
              ...(node.marks || []).filter((eMark: string) => eMark !== mark),
              mark
            ]
            Transforms.setNodes(editor, {marks}, {at: path})
          })
          normalizeSimilarSiblings(editor)
        } else {
          const existingMarks =
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
          normalizeSimilarSiblings(editor)
        } else {
          const existingMarks =
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
}


/**
 * Normalize re-marked Text nodes in selection
 *
 * @param {Editor} editor
 */
function normalizeSimilarSiblings(editor: Editor, selection?: Range) {
  const _selection = selection || editor.selection
  if (_selection) {
    for (const [node, path] of Array.from(
      Editor.nodes(editor, {
        at: Editor.range(editor, [_selection.anchor.path[0]], [_selection.focus.path[0]]),
        match: Text.isText
      })
    ).reverse()) {
      const [parent] = Editor.node(editor, Path.parent(path))
      const nextPath = [path[0], path[1] + 1]
      const nextText = parent.children[nextPath[1]]
      if (nextText && isEqual(nextText.marks, node.marks)) {
        Transforms.insertText(editor, nextText.text, {at: {path, offset: node.text.length}})
        Transforms.removeNodes(editor, {at: nextPath})
      }
    }
  }
}
