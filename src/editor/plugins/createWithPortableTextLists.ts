import {Editor, Transforms, Element} from 'slate'
import {PortableTextFeatures} from '../../types/portableText'
import {EditorChange} from '../../types/editor'
import {debugWithName} from '../../utils/debug'
import {toPortableTextRange} from '../../utils/selection'
import {Subject} from 'rxjs'
import {throttle} from 'lodash'

const debug = debugWithName('plugin:withPortableTextLists')
const MAX_LIST_LEVEL = 10

export function createWithPortableTextLists(
  portableTextFeatures: PortableTextFeatures,
  change$: Subject<EditorChange>
) {
  return function withPortableTextLists(editor: Editor) {
    // // Extend Slate's default normalization to set / unset level on .listItem blocks.
    // const {normalizeNode} = editor
    // editor.normalizeNode = nodeEntry => {
    //   normalizeNode(nodeEntry)
    //   const operations = editor.operations.map(op => {
    //     if (op.type === 'set_node' && op.newProperties && op.newProperties.listItem) {
    //       // debug('Normalizing level for list item')
    //       op.newProperties.level = op.newProperties.level || 1
    //     } else if (op.newProperties && op.newProperties.level) {
    //       // TODO: will level be used otherwise? Text indentation?
    //       // debug('Deleting obsolete level prop from non list item')
    //       delete op.newProperties.level
    //     }
    //     return op
    //   })
    //   editor.operations = operations
    // }

    editor.pteToggleListItem = (listItemStyle: string) => {
      if (!editor.selection) {
        return
      }
      const selectedBlocks = [
        ...Editor.nodes(editor, {
          at: editor.selection,
          match: node =>
            Element.isElement(node) && node._type === portableTextFeatures.types.block.name
        })
      ]
      selectedBlocks.forEach(([node, path]) => {
        const {listItem, level, ...rest} = node
        if (node.listItem === listItemStyle) {
          debug(`Unsetting list '${listItemStyle}'`)
          Transforms.setNodes(editor, {...rest, listItem: undefined, level: undefined}, {at: path})
        } else {
          debug(`Setting list '${listItemStyle}'`)
          Transforms.setNodes(
            editor,
            {
              ...rest,
              level: 1,
              listItem:
                listItemStyle ||
                (portableTextFeatures.lists[0] && portableTextFeatures.lists[0].value)
            },
            {at: path}
          )
        }
      })
      // Emit a new selection here (though it might be the same).
      // This is for toolbars etc that listens to selection changes to update themselves.
      change$.next({type: 'selection', selection: toPortableTextRange(editor)})
      editor.onChange()
    }

    editor.pteEndList = () => {
      if (!editor.selection) {
        return
      }
      const selectedBlocks = [
        ...Editor.nodes(editor, {
          at: editor.selection,
          match: node =>
            Element.isElement(node) &&
            node._type === portableTextFeatures.types.block.name &&
            node.listItem &&
            node.children.length === 1 &&
            node.children[0].text === ''
        })
      ]
      if (selectedBlocks.length === 0) {
        return
      }
      selectedBlocks.forEach(([node, path]) => {
        debug('Unset list')
        Transforms.setNodes(editor, {...node, level: undefined, listItem: undefined}, {at: path})
      })
      change$.next({type: 'selection', selection: toPortableTextRange(editor)})
      return true // Note: we are exiting the plugin chain by not returning editor (or hotkey plugin 'enter' will fire)
    }

    editor.pteIncrementBlockLevels = throttle((reverse: boolean): void => {
      if (!editor.selection) {
        return
      }
      const selectedBlocks = [
        ...Editor.nodes(editor, {
          at: editor.selection,
          match: node => Element.isElement(node) && node.listItem
        })
      ]
      if (selectedBlocks.length === 0) {
        return
      }
      selectedBlocks.forEach(([node, path]) => {
        let level = node.level || 1
        if (reverse) {
          level--
          debug('Decrementing list level', Math.min(MAX_LIST_LEVEL, Math.max(1, level)))
        } else {
          level++
          debug('Incrementing list level', Math.min(MAX_LIST_LEVEL, Math.max(1, level)))
        }
        Transforms.setNodes(
          editor,
          {level: Math.min(MAX_LIST_LEVEL, Math.max(1, level))},
          {at: path}
        )
      })
      change$.next({type: 'selection', selection: toPortableTextRange(editor)})
      editor.onChange()
    }, 100)
    return editor
  }
}
