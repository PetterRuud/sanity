import {Editor, Transforms, Element} from 'slate'
import {PortableTextFeatures} from '../../types/portableText'

export function createWithPortableTextLists(portableTextFeatures: PortableTextFeatures) {
  return function withPortableTextLists(editor: Editor) {
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
        if (node.listItem) {
          Transforms.insertNodes(editor, rest, {at: path})
        } else {
          Transforms.insertNodes(
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
    }

    editor.pteEndList = (): boolean => {
      if (!editor.selection) {
        return false
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
        return false
      }
      selectedBlocks.forEach(([node, path]) => {
        Transforms.setNodes(editor, {...node, level: undefined, listItem: undefined}, {at: path})
      })
      return true
    }

    editor.pteIncrementBlockLevels = (reverse: boolean): boolean => {
      if (!editor.selection) {
        return false
      }
      const selectedBlocks = [
        ...Editor.nodes(editor, {
          at: editor.selection,
          match: node => Element.isElement(node) && node.listItem
        })
      ]
      if (selectedBlocks.length === 0) {
        return false
      }
      selectedBlocks.forEach(([node, path]) => {
        let level = node.level || 1
        if (reverse) {
          level--
        } else {
          level++
        }
        Transforms.setNodes(editor, {level: Math.min(10, Math.max(1, level))}, {at: path})
      })
      return true
    }
    return editor
  }
}
