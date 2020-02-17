import {Editor} from 'slate'
import isHotkey from 'is-hotkey'

const DEFAULT_HOTKEYS = {
  marks: {
    'mod+b': 'strong',
    'mod+i': 'em',
    'mod+u': 'underline',
    'mod+`': 'code'
  }
}

/**
 * This plugin takes care of hotkeys in the editor
 *
 */
export function createWithHotkeys(hotkeys) {
  const activeHotkeys = hotkeys || DEFAULT_HOTKEYS
  return function withHotKeys(editor: Editor) {
    editor.withHotKeys = (editor: Editor, event: React.KeyboardEvent<HTMLDivElement>) => {
      Object.keys(activeHotkeys).forEach(cat => {
        // Deal with customizable marks hotkeys
        if (cat === 'marks') {
          for (const hotkey in hotkeys[cat]) {
            if (isHotkey(hotkey, event.nativeEvent)) {
              event.preventDefault()
              const mark = hotkeys[cat][hotkey]
              editor.toggleMark(editor, mark)
            }
          }
        }
      })
      // Add tab to deal with lists
      if (isHotkey('tab', event.nativeEvent)) {
        event.preventDefault()
        editor.onTab(event)
      }
      return editor
    }
    return editor
  }
}
