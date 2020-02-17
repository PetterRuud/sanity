import {Editor} from 'slate'
import {PortableTextFeatures} from '../../types/portableText'

export function createWithPortableTextLists(
  portableTextFeatures: PortableTextFeatures
) {
  return function withPortableTextLists(editor: Editor) {
    editor.onTab = event => {
      console.log('hey!')
    }
    return editor
  }
}
