import {Editor, Element, Operation} from 'slate'
import {PortableTextFeatures} from '../../types/portableText'
import {debugWithName} from '../../utils/debug'

const debug = debugWithName('plugin:withSchemaTypes')
/**
 * This plugin makes sure that shema types are recognized properly by Slate as blocks, voids, inlines
 *
 */
export function createWithSchemaTypes(portableTextFeatures: PortableTextFeatures) {
  return function withSchemaTypes(editor: Editor) {
    editor.isVoid = (element: Element): boolean => {
      return (
        portableTextFeatures.types.blockObjects.map(obj => obj.name).includes(element._type) ||
        portableTextFeatures.types.inlineObjects.map(obj => obj.name).includes(element._type)
      )
    }
    editor.isInline = (element: Element): boolean => {
      const inlineSchemaTypes = portableTextFeatures.types.inlineObjects.map(obj => obj.name)
      return inlineSchemaTypes.includes(element._type) && element.__inline === true
    }
    // Extend Slate's default normalization to add _type span to span inserted after a inline void object
    const {apply} = editor
    editor.apply = (op: Operation) => {
      const isInsertTextWithoutType =
        op.type === 'insert_node' && op.path.length === 2 && op.node._type === undefined
      if (isInsertTextWithoutType) {
        const newNode = {...op.node, _type: portableTextFeatures.types.span.name}
        op.node = newNode
        debug('Setting span type to child without a type', op)
      }
      apply(op)
    }
    return editor
  }
}
