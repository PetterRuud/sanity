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
        const fragment = Node.fragment(editor, editor.selection).map(node => {
          const newNode = {...node}
          // Ensure the copy has new keys
          if (newNode.markDefs && Array.isArray(newNode.markDefs)) {
            newNode.markDefs = newNode.markDefs.map(def => {
              const oldKey = def._key
              const newKey = keyGenerator()
              if (Array.isArray(newNode.children)) {
                newNode.children = newNode.children.map(child =>
                  child._type === portableTextFeatures.types.span.name
                    ? {
                        ...child,
                        marks: child.marks.includes(oldKey)
                          ? [...child.marks].filter(mark => mark !== oldKey).concat(newKey)
                          : child.marks
                      }
                    : child
                )
              }
              return {...def, _key: newKey}
            })
          }
          const nodeWithNewKeys = {...newNode, _key: keyGenerator()} as Node
          if (Array.isArray(nodeWithNewKeys.children)) {
            nodeWithNewKeys.children = nodeWithNewKeys.children.map(child => ({
              ...child,
              _key: keyGenerator()
            }))
          }
          return nodeWithNewKeys
        })
        return fragment
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
        const fragment = JSON.parse(decoded) as Node[]
        const pText = fromSlateValue(fragment, portableTextFeatures.types.block.name)
        const validation = validateValue(pText, portableTextFeatures, keyGenerator)
        if (validation.valid) {
          debug('inserting editor fragment', fragment)
          if (fragment.length === 1 && editor.selection) {
            const [block] = Editor.node(editor, editor.selection, {depth: 1})
            Transforms.insertFragment(editor, fragment)
            Transforms.setNodes(
              editor,
              {
                markDefs: [
                  ...(Array.isArray(block.markDefs) ? block.markDefs : []),
                  ...(Array.isArray(fragment[0].markDefs) ? fragment[0].markDefs : [])
                ]
              },
              {at: editor.selection?.focus.path.slice(0, 1)}
            )
          } else {
            Transforms.insertNodes(editor, fragment, {at: editor.selection?.focus.path.slice(0, 1)})
          }
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
          } else {
            Transforms.splitNodes(editor)
          }
        }
        if (fragment.length === 1) {
          Transforms.insertFragment(editor, fragment)
          Transforms.setNodes(
            editor,
            {markDefs: fragment[0].markDefs},
            {at: editor.selection?.focus.path.slice(0, 1)}
          )
        } else {
          Transforms.insertNodes(editor, fragment, {at: editor.selection?.focus.path.slice(0, 1)})
        }
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
