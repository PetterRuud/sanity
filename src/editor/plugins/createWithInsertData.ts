import {PortableTextFeatures} from '../../types/portableText'
import {EditorChanges} from '../../types/editor'
import {Transforms, Node} from 'slate'
import {ReactEditor} from 'slate-react'
import {fromSlateValue} from '../../utils/values'
import {validateValue} from '../../utils/validateValue'
import {debugWithName} from '../../utils/debug'

const debug = debugWithName('plugin:withInsertData')

/**
 * This plugin handles pasting and drag/drop to the editor
 *
 */
export function createWithInsertData(
  change$: EditorChanges,
  portableTextFeatures: PortableTextFeatures,
  keyGenerator: () => string
) {
  return function withInsertData(editor: ReactEditor) {
    // const {insertData} = editor
    editor.insertData = data => {
      change$.next({type: 'loading', isLoading: true})
      const html = data.getData('text/html')
      const slateFragment = data.getData('application/x-slate-fragment')
      // const portableText = data.getData('application/x-portable-text')
      const text = data.getData('text/plain')
      // if (portableText) {
      //   const parsed = JSON.parse(portableText)
      //   if (Array.isArray(parsed) && parsed.length > 0) {
      //     debug('inserting portable text', parsed)
      //     return true
      //   }
      // }
      if (slateFragment) {
        const decoded = decodeURIComponent(window.atob(slateFragment))
        const parsed = JSON.parse(decoded) as Node[]
        const pText = fromSlateValue(parsed, portableTextFeatures.types.block.name)
        const validation = validateValue(pText, portableTextFeatures, keyGenerator)
        if (validation.valid) {
          debug('inserting fragment', parsed)
          Transforms.insertFragment(editor, parsed)
          editor.onChange()
          change$.next({type: 'loading', isLoading: false})
          return
        }
        debug('Invalid fragment', slateFragment)
      }

      if (html) {
        debug('inserting html', html)
        change$.next({type: 'loading', isLoading: false})
        return
      }

      if (text) {
        if (text) {
          const lines = text.split(/\r\n|\r|\n/)
          let split = false

          for (const line of lines) {
            if (split) {
              Transforms.splitNodes(editor, {always: true})
            }
            Transforms.insertText(editor, line)
            split = true
          }
        }
      }
      change$.next({type: 'loading', isLoading: false})
    }
    return editor
  }
}
