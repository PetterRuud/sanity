import {Editor, Element} from 'slate'
import {PortableTextFeatures} from '../../types/portableText'

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
      return (
        inlineSchemaTypes.includes(element._type) && element.__inline === true
      )
    }
    return editor
  }
}
