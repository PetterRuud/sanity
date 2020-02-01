import {Editor} from 'slate'


/**
 * This plugin makes shure that every new node in the editor get a new _key prop when created
 *
 */
export function createWithKeys(keyGenerator: () => string) {
  return function withKeys(editor: Editor) {
    const {apply} = editor
    editor.apply = operation => {
      if (operation.type === 'split_node') {
        operation.properties = {...operation.properties, _key: keyGenerator()}
      }
      if (operation.type === 'insert_node') {
        operation.node = {...operation.node, _key: keyGenerator()}
      }
      apply(operation)
    }
    return editor
  }
}
