import {Node as SlateNode, Operation as SlateOperation, Editor as SlateEditor} from 'slate'

export type EditorNode = SlateNode & {
  _key: string
  _type: string
}

export type EditorOperation = SlateOperation

export type EditorSelection = any


export interface PortableTextSlateEditor extends SlateEditor {
  /**
   * Increments selected list items levels, or decrements them if @reverse is true.
   *
   * @param {Editor} editor
   * @param {boolean} reverse
   * @returns {boolean} True if anything was incremented in the selection
   */
  pteIncrementBlockLevels: (editor: SlateEditor, reverse?: boolean) => boolean
  /**
   * Toggle blocks as listItem
   *
   * @param {Editor} editor
   * @param {string} listItemStyle
   */
  pteToggleListItem: (editor: SlateEditor, listStyle: string) => void
  /**
   * Ends a list
   *
   * @param {Editor} editor
   * @returns {boolean} True if a list was ended in the selection
   */
  pteEndList: (editor: SlateEditor) => boolean
  /**
   * Toggle marks in the selection
   *
   * @param {Editor} editor
   * @param {string} mark
   */
  pteToggleMark: (editor: SlateEditor, mark: string) => void
}
