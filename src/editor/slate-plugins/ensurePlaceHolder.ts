import {Editor} from 'slate'
import {PortableTextFeatures} from '../../types/portableText'

export const PLACEHOLDERKEY = '__placeholder__'

export function createEnsurePlaceHolderBlock(
  portableTextFeatures: PortableTextFeatures,
  keyGenerator: () => string
) {
  return function ensurePlaceHolderBlock(editor: Editor) {
    const {apply} = editor
    editor.apply = operation => {
      apply(operation)
      if (operation.type !== 'set_node') {
        setPlaceHolderBlock(editor, keyGenerator)
      }
      if (['insert_text', 'insert_node', 'split_node', 'merge_node'].includes(operation.type)) {
        unsetPlaceHolderBlockKey(editor, keyGenerator)
      }
      // if (['set_node'].includes(operation.type)) {
      //   removePlaceHolderBlock(editor)
      // }
      insertPlaceHolderBlock(editor, keyGenerator, portableTextFeatures)
    }
    return editor
  }
}

function insertPlaceHolderBlock(
  editor: Editor,
  keyGenerator,
  portableTextFeatures: PortableTextFeatures
) {
  if (editor.children.length === 0) {
    editor.apply({
      type: 'insert_node',
      path: [0],
      node: {
        _type: portableTextFeatures.types.block.name,
        _key: PLACEHOLDERKEY,
        children: [{_key: keyGenerator(), _type: 'span', marks: [], text: ''}],
        markDefs: []
      }
    })
  }
}

// function removePlaceHolderBlock(editor: Editor) {
//   if (editor.children.length === 1 && editor.children[0]._key === PLACEHOLDERKEY) {
//     editor.apply({
//       type: 'remove_node',
//       path: [0],
//       node: editor.children[0]
//     })
//   }
// }

function unsetPlaceHolderBlockKey(editor: Editor, keyGenerator: () => string) {
  if (editor.children.length === 1 && editor.children[0]._key === PLACEHOLDERKEY) {
    editor.apply({
      type: 'set_node',
      path: [0],
      properties: {_key: PLACEHOLDERKEY},
      newProperties: {_key: keyGenerator()}
    })
  }
}

function setPlaceHolderBlock(editor: Editor, keyGenerator: () => string) {
  if (
    editor.children.length === 1 &&
    editor.children[0].children &&
    editor.children[0].children[0] &&
    editor.children[0].children[0]._type === 'span' &&
    editor.children[0].children[0]._key !== PLACEHOLDERKEY &&
    editor.children[0].children[0].text === ''
  ) {
    editor.apply({
      type: 'set_node',
      path: [0],
      properties: {_key: editor.children[0]._key},
      newProperties: {_key: PLACEHOLDERKEY}
    })
  }
}
