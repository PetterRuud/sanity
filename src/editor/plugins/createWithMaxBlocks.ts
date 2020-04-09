import {Editor} from 'slate'

/**
 * This plugin makes sure that the PTE maxBlocks prop is respected
 *
 */
export function createWithMaxBlocks(rows: number) {
  return function withMaxBlocks(editor: Editor) {
    const {apply} = editor
    editor.apply = operation => {
      if (rows > 0 && editor.children.length >= rows) {
        if (['insert_node', 'split_node'].includes(operation.type) && operation.path.length === 1) {
          return
        }
      }
      apply(operation)
    }
    return editor
  }
}
