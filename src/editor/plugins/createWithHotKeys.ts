import {Editor, Transforms, Path, Range} from 'slate'
import isHotkey from 'is-hotkey'
import {PortableTextSlateEditor} from '../../types/editor'
import {HotkeyOptions} from '../../types/options'
import {debugWithName} from '../../utils/debug'
import {toSlateValue} from '../../utils/values'
import {PortableTextFeatures} from 'src/types/portableText'
import { ReactEditor } from '@sanity/slate-react'

const debug = debugWithName('plugin:withHotKeys')

const DEFAULT_HOTKEYS: HotkeyOptions = {
  marks: {
    'mod+b': 'strong',
    'mod+i': 'em',
    'mod+u': 'underline',
    'mod+`': 'code'
  },
  custom: {}
}

/**
 * This plugin takes care of all hotkeys in the editor
 * TODO: move a lot of these out the their respective plugins
 *
 */
export function createWithHotkeys(
  portableTextFeatures: PortableTextFeatures,
  keyGenerator: () => string,
  hotkeysFromOptions?: HotkeyOptions
) {
  const reservedHotkeys = ['enter', 'tab', 'shift', 'delete', 'end']
  const activeHotkeys = hotkeysFromOptions || DEFAULT_HOTKEYS // TODO: Merge where possible? A union?
  return function withHotKeys(editor: PortableTextSlateEditor & ReactEditor) {
    editor.pteWithHotKeys = (event: React.KeyboardEvent<HTMLDivElement>): void | boolean => {
      // Wire up custom marks hotkeys
      Object.keys(activeHotkeys).forEach(cat => {
        if (cat === 'marks') {
          for (const hotkey in activeHotkeys[cat]) {
            if (reservedHotkeys.includes(hotkey)) {
              throw new Error(`The hotkey ${hotkey} is reserved!`)
            }
            if (isHotkey(hotkey, event.nativeEvent)) {
              event.preventDefault()
              const possibleMark = activeHotkeys[cat]
              if (possibleMark) {
                const mark = possibleMark[hotkey]
                debug(`HotKey ${hotkey} to toggle ${mark}`)
                editor.pteToggleMark(mark)
              }
            }
          }
        }
        if (cat === 'custom') {
          for (const hotkey in activeHotkeys[cat]) {
            if (reservedHotkeys.includes(hotkey)) {
              throw new Error(`The hotkey ${hotkey} is reserved!`)
            }
            if (isHotkey(hotkey, event.nativeEvent)) {
              event.preventDefault()
              const possibleCommand = activeHotkeys[cat]
              if (possibleCommand) {
                const command = possibleCommand[hotkey]
                command(event)
              }
            }
          }
        }
      })

      const isEnter = isHotkey('enter', event.nativeEvent)
      const isTab = isHotkey('tab', event.nativeEvent)
      const isShiftEnter = isHotkey('shift+enter', event.nativeEvent)
      const isShiftTab = isHotkey('shift+tab', event.nativeEvent)
      const isBackspace = isHotkey('backspace', event.nativeEvent)
      const isDelete = isHotkey('delete', event.nativeEvent)

      // Disallow deleting void blocks by backspace from another line.
      // Otherwise it's so easy to delete the void block above when trying to delete text on
      // the line below or above
      if (
        isBackspace &&
        editor.selection &&
        editor.selection.focus.path[0] > 0 &&
        Range.isCollapsed(editor.selection)
      ) {
        const [prevBlock, prevPath] = Editor.node(
          editor,
          Path.previous(editor.selection.focus.path.slice(0, 1))
        )
        const [focusBlock] = Editor.node(editor, editor.selection.focus, {depth: 1})
        if (
          prevBlock &&
          focusBlock &&
          Editor.isVoid(editor, prevBlock) &&
          editor.selection.focus.offset === 0
        ) {
          debug('Preventing deleting void block above')
          event.preventDefault()
          event.stopPropagation()
          Transforms.removeNodes(editor, {match: n => n === focusBlock})
          Transforms.select(editor, prevPath)
          editor.onChange()
          return true
        }
      }
      if (
        isDelete &&
        editor.selection &&
        editor.selection.focus.offset === 0 &&
        Range.isCollapsed(editor.selection) &&
        editor.children[editor.selection.focus.path[0] + 1]
      ) {
        const [nextBlock] = Editor.node(editor, Path.next(editor.selection.focus.path.slice(0, 1)))
        const [focusBlock, focusBlockPath] = Editor.node(editor, editor.selection.focus, {depth: 1})
        if (
          nextBlock &&
          focusBlock &&
          !Editor.isVoid(editor, focusBlock) &&
          Editor.isVoid(editor, nextBlock)
        ) {
          debug('Preventing deleting void block below')
          event.preventDefault()
          event.stopPropagation()
          Transforms.removeNodes(editor, {match: n => n === focusBlock})
          Transforms.select(editor, focusBlockPath)
          editor.onChange()
          return true
        }
      }

      // There's a bug in Slate atm regarding void nodes not being deleted. Seems related
      // to 'hanging: true'. 2020/05/26
      if (
        (isDelete || isBackspace) &&
        editor.selection &&
        Range.isExpanded(editor.selection)
      ) {
        event.preventDefault()
        event.stopPropagation()
        Transforms.delete(editor, {at: editor.selection, voids: false, hanging: true})
        editor.onChange()
        return true
      }

      // Deal with tab for lists
      if (isTab || isShiftTab) {
        editor.pteIncrementBlockLevels(isShiftTab) && event.preventDefault()
        event.preventDefault()
      }

      // Deal with enter key
      if (isEnter && !isShiftEnter && editor.selection) {
        let focusBlock
        try {
          ;[focusBlock] = Editor.node(editor, editor.selection.focus, {depth: 1})
        } catch (err) {}
        // Deal with list item enter key
        if (focusBlock && focusBlock.listItem) {
          editor.pteEndList() && event.preventDefault()
          return
        }
        // Deal with block object enter key
        if (focusBlock && Editor.isVoid(editor, focusBlock)) {
          const block = toSlateValue(
            [
              {
                _type: portableTextFeatures.types.block.name,
                _key: keyGenerator(),
                style: 'normal',
                markDefs: [],
                children: [
                  {
                    _type: 'span',
                    _key: keyGenerator(),
                    text: '',
                    marks: []
                  }
                ]
              }
            ],
            portableTextFeatures.types.block.name
          )[0]
          Editor.insertNode(editor, block)
          event.preventDefault()
          return
        }
      }

      // Deal with soft line breaks
      if (isShiftEnter) {
        event.preventDefault()
        editor.insertText('\n')
        return
      }

      // Deal with undo/redo
      if (isHotkey('mod+z', event.nativeEvent)) {
        event.preventDefault()
        editor.undo()
        return
      }
      if (isHotkey('mod+y', event.nativeEvent) || isHotkey('mod+shift+z', event.nativeEvent)) {
        event.preventDefault()
        editor.redo()
        return
      }
    }
    return editor
  }
}
