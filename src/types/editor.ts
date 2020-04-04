import {Node as SlateNode, Operation as SlateOperation, Editor as SlateEditor} from 'slate'
import {Path} from '../types/path'
import {Patch} from '../types/patch'
import {Type} from '../types/schema'
import {PortableTextBlock} from '../types/portableText'

export type EditorNode = SlateNode & {
  _key: string
  _type: string
}

export type EditorOperation = SlateOperation

export type EditorSelectionPoint = {path: Path, offset: number}
export type EditorSelection = {anchor: EditorSelectionPoint, focus: EditorSelectionPoint} | null
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

export type EditorChange = {
  type: 'mutation' | 'value' | 'selection' | 'throttle' | 'focus' | 'blur' | 'pasting'
  patches?: Patch[]
  selection?: EditorSelection
  throttle?: boolean
  value?: PortableTextBlock[] | undefined
}

export type PasteProgressResult = {
  status: string | null
  error?: Error
}

export type OnPasteResult =
  | (
      | {
          insert?: PortableTextBlock[]
          path?: []
        }
      | Error)
  | null
export type OnPasteResultOrPromise = (OnPasteResult | Promise<OnPasteResult>) | null

export type OnPasteFn = (arg0: {
  event: React.SyntheticEvent
  path: []
  type: Type
  value: PortableTextBlock[] | null
}) => OnPasteResultOrPromise
