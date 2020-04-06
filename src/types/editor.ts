import {Node as SlateNode, Operation as SlateOperation, Editor as SlateEditor} from 'slate'
import {Path} from '../types/path'
import {Patch} from '../types/patch'
import {Type} from '../types/schema'
import {PortableTextBlock} from '../types/portableText'
import {Subject} from 'rxjs'

export type EditorNode = SlateNode & {
  _key: string
  _type: string
}

export type EditorOperation = SlateOperation

export type EditorSelectionPoint = {path: Path; offset: number}
export type EditorSelection = {anchor: EditorSelectionPoint; focus: EditorSelectionPoint} | null
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

export type MutationChange = {
  type: 'mutation'
  patches: Patch[]
}

export type ValueChange = {
  type: 'value'
  value: PortableTextBlock[] | undefined
}

export type SelectionChange = {
  type: 'selection'
  selection: EditorSelection
}

export type ThrottleChange = {
  type: 'throttle'
  throttle: boolean
}

export type FocusChange = {
  type: 'focus'
}

export type BlurChange = {
  type: 'blur'
}

export type LoadingChange = {
  type: 'loading'
  isLoading: boolean
}

export type InvalidValueResolution = null | {patches: Patch[]; description: string; action: string}

export type InvalidValue = {
  type: 'invalidValue'
  resolution: InvalidValueResolution
}

export type EditorChange =
  | MutationChange
  | ValueChange
  | SelectionChange
  | ThrottleChange
  | FocusChange
  | BlurChange
  | LoadingChange
  | InvalidValue

export type EditorChanges = Subject<EditorChange>

type OnPasteResult =
  | (
      | {
          insert?: PortableTextBlock[]
          path?: []
        }
      | Error
    )
  | null
type OnPasteResultOrPromise = (OnPasteResult | Promise<OnPasteResult>) | null

export type OnPasteFn = (arg0: {
  event: React.SyntheticEvent
  path: []
  type: Type
  value: PortableTextBlock[] | null
}) => OnPasteResultOrPromise

export type OnCopyFn = (event: React.ClipboardEvent<HTMLDivElement>) => undefined | any
