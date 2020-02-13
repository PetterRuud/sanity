import {Element, Transforms, Editor, Node} from 'slate'
import {PortableTextFeatures} from 'src/types/portableText'

/**
 * This plugin makes sure that every new node in the editor get a new _key prop when created
 *
 */
export function createWithKeys(
  portableTextFeatures: PortableTextFeatures,
  keyGenerator: () => string
) {
  return function withKeys(editor: Editor) {
    const {apply, normalizeNode} = editor
    editor.apply = operation => {
      if (operation.type === 'split_node') {
        operation.properties = {...operation.properties, _key: keyGenerator()}
      }
      if (operation.type === 'insert_node') {
        operation.node = {...operation.node, _key: keyGenerator()}
      }
      apply(operation)
    }
    editor.normalizeNode = entry => {
      const [node, path] = entry
      if (Element.isElement(node) && node._type === portableTextFeatures.types.block.name) {
        // Set key on block itself
        if (!node._key) {
          Transforms.setNodes(editor, {_key: keyGenerator()}, {at: path})
        }
        // Set keys on it's children
        for (const [child, childPath] of Node.children(editor, path)) {
          if (!child._key) {
            Transforms.setNodes(editor, {_key: keyGenerator()}, {at: childPath})
            return
          }
        }
      }
      // Do the original `normalizeNode` to enforce other constraints.
      normalizeNode(entry)
    }

    return editor
  }
}
