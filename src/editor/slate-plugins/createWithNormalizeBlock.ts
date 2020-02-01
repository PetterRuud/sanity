import {Element, Transforms, Editor, Node} from 'slate'
import {PortableTextFeatures} from 'src/types/portableText'

// This plugins ensures that every node in the value is normalized
export function normalizeAsPortableText(
  portableTextFeatures: PortableTextFeatures,
  keyGenerator: () => string
) {
  return function withNormalizeBlock(editor: Editor) {
    const {normalizeNode} = editor
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
      // Fall back to the original `normalizeNode` to enforce other constraints.
      normalizeNode(entry)
    }
    return editor
  }
}
