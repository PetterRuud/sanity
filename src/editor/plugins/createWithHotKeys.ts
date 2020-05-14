import {Editor, Transforms} from 'slate'
import isHotkey from 'is-hotkey'
import {PortableTextSlateEditor} from '../../types/editor'
import {HotkeyOptions} from '../../types/options'
import {debugWithName} from '../../utils/debug'

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
export function createWithHotkeys(hotkeysFromOptions?: HotkeyOptions) {
  const reservedHotkeys = ['enter', 'tab', 'shift', 'delete', 'end']
  const activeHotkeys = hotkeysFromOptions || DEFAULT_HOTKEYS // TODO: Merge where possible? A union?
  return function withHotKeys(editor: PortableTextSlateEditor) {
    let backspaceCount = 0
    editor.pteWithHotKeys = (event: React.KeyboardEvent<HTMLDivElement>) => {
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
      const isEnd = isHotkey('end', event.nativeEvent)
      // const isShift = isHotkey('shift', event.nativeEvent)

      if (isEnd) {
        event.preventDefault()
        Transforms.move(editor, {unit: 'line'})
        return
      }

      // Disallow deleting void blocks by backspace from another line unless pressed twice.
      // Otherwise it's so easy to delete the void block above when trying to delete text on
      // the line below
      if (isBackspace) {
        const prevBlock = editor.selection && editor.children[editor.selection.focus.path[0] - 1]
        const focusBlock = editor.selection && editor.children[editor.selection.focus.path[0]]
        if (
          prevBlock &&
          focusBlock &&
          Editor.isVoid(editor, prevBlock) &&
          editor.selection &&
          editor.selection.focus.offset === 0 &&
          backspaceCount < 1
        ) {
          event.preventDefault()
          backspaceCount++
        } else if (backspaceCount >= 1) {
          backspaceCount = 0
        }
        return
      }

      // Deal with tab for lists
      if (isTab || isShiftTab) {
        editor.pteIncrementBlockLevels(isShiftTab) && event.preventDefault()
        event.preventDefault()
      }

      // Deal with list item enter key
      if (isEnter && !isShiftEnter) {
        editor.pteEndList() && event.preventDefault()
        return
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
