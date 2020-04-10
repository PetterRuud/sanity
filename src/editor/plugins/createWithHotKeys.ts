import {Editor} from 'slate'
import isHotkey from 'is-hotkey'
import {PortableTextSlateEditor} from '../../types/editor'

const DEFAULT_HOTKEYS = {
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
 *
 */
export function createWithHotkeys(hotkeys, change$, portableTextFeatures) {
  const reservedHotkeys = ['enter', 'tab', 'shift', 'delete']
  const activeHotkeys = hotkeys || DEFAULT_HOTKEYS
  return function withHotKeys(editor: Editor) {
    let backspaceCount = 0
    editor.pteWithHotKeys = (
      editor: PortableTextSlateEditor,
      event: React.KeyboardEvent<HTMLDivElement>
    ) => {
      // Wire up custom marks hotkeys
      Object.keys(activeHotkeys).forEach(cat => {
        if (cat === 'marks') {
          for (const hotkey in hotkeys[cat]) {
            if (reservedHotkeys.includes(hotkey)) {
              throw new Error(`The hotkey ${hotkey} is reserved!`)
            }
            if (isHotkey(hotkey, event.nativeEvent)) {
              event.preventDefault()
              const mark = hotkeys[cat][hotkey]
              editor.pteToggleMark(editor, mark)
            }
          }
        }
        if (cat === 'custom') {
          for (const hotkey in hotkeys[cat]) {
            if (reservedHotkeys.includes(hotkey)) {
              throw new Error(`The hotkey ${hotkey} is reserved!`)
            }
            if (isHotkey(hotkey, event.nativeEvent)) {
              event.preventDefault()
              const command = hotkeys[cat][hotkey]
              command(event)
            }
          }
        }
      })

      const isEnter = isHotkey('enter', event.nativeEvent)
      const isTab = isHotkey('tab', event.nativeEvent)
      const isShiftEnter = isHotkey('shift+enter', event.nativeEvent)
      const isShiftTab = isHotkey('shift+tab', event.nativeEvent)
      const isBackspace = isHotkey('backspace', event.nativeEvent)

      // Disallow deleting void blocks by backspace from another line
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
      }

      // Deal with tab for lists
      if (isTab || isShiftTab) {
        editor.pteIncrementBlockLevels(editor, isShiftTab) && event.preventDefault()
      }

      // Deal with list item enter key
      if (isEnter && !isShiftEnter) {
        editor.pteEndList(editor) && event.preventDefault()
      }

      // Deal with soft line breaks
      if (isShiftEnter) {
        event.preventDefault()
        editor.insertText('\n')
      }

      // TODO: Deal with search/replace? Plugin perhaps?

      // Deal with undo/redo
      if (isHotkey('mod+z', event.nativeEvent)) {
        event.preventDefault()
        editor.undo()
      }
      if (isHotkey('mod+y', event.nativeEvent) || isHotkey('mod+shift+z', event.nativeEvent)) {
        event.preventDefault()
        editor.redo()
      }
    }
    return editor
  }
}
