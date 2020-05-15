import {htmlToBlocks} from '@sanity/block-tools'
import {PortableTextFeatures} from '../../types/portableText'
import {EditorChanges, PortableTextSlateEditor} from '../../types/editor'
import {Transforms, Node, Editor} from 'slate'
import {ReactEditor} from '@sanity/slate-react'
import {fromSlateValue, toSlateValue, isEqualToEmptyEditor} from '../../utils/values'
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
  return function withInsertData(editor: PortableTextSlateEditor & ReactEditor) {
    const {setFragmentData} = editor
    editor.setFragmentData = (data: DataTransfer) => {
      debug('Set fragment data')
      setFragmentData(data)
    }
    editor.getFragment = () => {
      debug('Get fragment data')
      if (editor.selection) {
        return Node.fragment(editor, editor.selection)
      }
      return []
    }
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
          debug('inserting editor fragment')
          Transforms.insertFragment(editor, parsed)
          editor.onChange()
          change$.next({type: 'loading', isLoading: false})
          return
        }
        debug('Invalid fragment', slateFragment)
      }

      if (html) {
        const portableText = htmlToBlocks(html, portableTextFeatures.types.portableText)
        const fragment = toSlateValue(portableText, portableTextFeatures.types.block.name)
        debug('Inserting HTML')
        if (fragment.length === 0) {
          debug('Empty fragment')
          return
        }
        // debug('portableText', portableText)
        // debug('fragment', fragment)
        Transforms.splitNodes(editor)
        if (editor.selection) {
          // If the text is empty, use the block style from the fragment.
          const [block] = Editor.node(editor, editor.selection, {depth: 1})
          const isEmptyText = isEqualToEmptyEditor([block], portableTextFeatures)
          if (isEmptyText) {
            Transforms.setNodes(
              editor,
              {style: fragment[0].style},
              {at: editor.selection?.focus.path.slice(0, 1)}
            )
          }
        }
        Transforms.insertFragment(editor, fragment)
        editor.onChange()
        change$.next({type: 'loading', isLoading: false})
        return
      }

      if (text) {
        debug('Inserting plain text')
        const lines = text.split(/\n\n/)
        let split = false

        for (const line of lines) {
          if (split) {
            Transforms.splitNodes(editor, {always: true})
          }
          Transforms.insertText(editor, line)
          split = true
        }
        return
      }
      change$.next({type: 'loading', isLoading: false})
    }
    return editor
  }
}
