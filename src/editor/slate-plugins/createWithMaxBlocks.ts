import {Editor} from 'slate'

/**
 * This plugin makes sure that the PTE rows prop is respected
 *
 */
export function createWithMaxBlocks(rows: number) {
  return function withRows(editor: Editor) {
    const {apply} = editor
    editor.apply = operation => {
      if (editor.children.length <= rows) {
        if (['insert_node', 'split_node'].includes(operation.type) && operation.path.length === 1) {
          return
        }
      }
      apply(operation)
    }
    return editor
  }
}
