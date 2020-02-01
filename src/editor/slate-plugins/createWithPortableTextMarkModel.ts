import {Editor, Range, Transforms, Text} from 'slate'
import {ReactEditor} from 'slate-react'

// This plugin makes shure that every new node in the editor get a new _key prop
export function createWithPortableTextMarkModel() {
  return function withPortableTextMarkModel(editor: Editor & ReactEditor) {
    editor.addMark = (mark: string) => {
      const {selection} = editor
      if (selection) {
        const existingMarks =
        {
          ...(Editor.marks(editor) || {})
        }.marks || []
        if (Range.isExpanded(selection)) {
          Transforms.setNodes(editor, {marks: [...existingMarks, mark]}, {match: Text.isText, split: true})
        } else {
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
      const {selection} = editor
      if (selection) {
        const existingMarks =
        {
          ...(Editor.marks(editor) || {})
        }.marks || []
        const newMarks = existingMarks.filter(eMark => eMark !== mark)
        if (Range.isExpanded(selection)) {
          Transforms.setNodes(
            editor,
            {marks: newMarks},
            {
              match: Text.isText,
              split: true
            }
          )
        } else {
          const marks = {
            ...(Editor.marks(editor) || {}),
            marks: newMarks
          }
          editor.marks = marks
          editor.onChange()
        }
      }
    }
    return editor
  }
}
