import {Editor} from 'slate'
import {ReactEditor} from 'slate-react'

// This plugin makes shure that every new node in the editor get a new _key prop when created
export function createWithKeysPlugin(keyGenerator: () => string) {
  return function withKeys(editor: Editor & ReactEditor) {
    const {apply} = editor
    const requiresNewKeyActions = ['split_node', 'insert_node']
    editor.apply = operation => {
      if (requiresNewKeyActions.includes(operation.type)) {
        if (operation.type === 'split_node') {
          operation.properties._key = keyGenerator()
        }
        if (operation.type === 'insert_node') {
          operation.node._key = keyGenerator()
        }
      }
      apply(operation)
    }
    return editor
  }
}
