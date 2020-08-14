import {Node as SlateNode, Operation as SlateOperation, Editor as SlateEditor} from 'slate'
import {Path} from '../types/path'
import {Patch} from '../types/patch'
import {Type} from '../types/schema'
import {PortableTextBlock, PortableTextChild} from '../types/portableText'
import {Subject, Observable} from 'rxjs'
export interface EditableAPI {
  activeAnnotations: () => PortableTextBlock[]
  addAnnotation: (
    type: Type,
    value?: {[prop: string]: any}
  ) => {spanPath: Path; markDefPath: Path} | undefined
  blur: () => void
  delete: (selection?: EditorSelection, options?: {mode?: 'block' | 'children'}) => void
  findByPath: (path: Path) => [PortableTextBlock | PortableTextChild | undefined, Path | undefined]
  findDOMNode: (element: PortableTextBlock | PortableTextChild) => Node
  focus: () => void
  focusBlock: () => PortableTextBlock | undefined
  focusChild: () => PortableTextChild | undefined
  getSelection: () => EditorSelection | undefined
  getValue: () => PortableTextBlock | undefined
  hasBlockStyle: (style: string) => boolean
  insertBlock: (type: Type, value?: {[prop: string]: any}) => Path
  insertChild: (type: Type, value?: {[prop: string]: any}) => Path
  isMarkActive: (mark: string) => boolean
  isVoid: (element: PortableTextBlock | PortableTextChild) => boolean
  marks: () => string[]
  redo: () => void
  removeAnnotation: (type: Type) => void
  select: (selection: EditorSelection) => void
  toggleBlockStyle: (blockStyle: string) => void
  toggleList: (listStyle: string) => void
  toggleMark: (mark: string) => void
  undo: () => void
}

export type EditorNode = SlateNode & {
  _key: string
  _type: string
}

export type HistoryItem = {
  operations: SlateOperation[]
  timestamp: Date
}

export interface History {
  redos: HistoryItem[]
  undos: HistoryItem[]
}

export type EditorSelectionPoint = {path: Path; offset: number}
export type EditorSelection = {anchor: EditorSelectionPoint; focus: EditorSelectionPoint} | null
export interface PortableTextSlateEditor extends SlateEditor {
  editable: EditableAPI
  history: History
  /**
   * Increments selected list items levels, or decrements them if @reverse is true.
   *
   * @param {boolean} reverse
   * @returns {boolean} True if anything was incremented in the selection
   */
  pteIncrementBlockLevels: (reverse?: boolean) => boolean
  /**
   * Toggle blocks as listItem
   *
   * @param {string} listStyle
   */
  pteToggleListItem: (listStyle: string) => void
  /**
   * Ends a list
   *
   * @returns {boolean} True if a list was ended in the selection
   */
  pteEndList: () => boolean
  /**
   * Toggle marks in the selection
   *
   * @param {string} mark
   */
  pteToggleMark: (mark: string) => void
  /**
   * Teset if a mark is active in the current selection
   *
   * @param {string} mark
   */
  pteIsMarkActive: (mark: string) => boolean
  /**
   * Toggle the selected block style
   *
   * @param {string} style The style name
   *
   */
  pteToggleBlockStyle: (style: string) => void
  /**
   * Test if the current selection has a certain block style
   *
   * @param {string} style The style name
   *
   */
  pteHasBlockStyle: (style: string) => boolean
  /**
   * Try to expand the current selection to a word
   *
   */
  pteExpandToWord: () => void
  /**
   * Use hotkeys
   *
   */
  pteWithHotKeys: (event: React.KeyboardEvent<HTMLDivElement>) => void
  /**
   * Undo
   *
   */
  undo: () => void
  /**
   * Redo
   *
   */
  redo: () => void
}

export type MutationChange = {
  type: 'mutation'
  patches: Patch[]
}

export type PatchChange = {
  type: 'patch'
  patch: Patch
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

export type UnsetChange = {
  type: 'unset'
  previousValue: PortableTextBlock[]
}

export type BlurChange = {
  type: 'blur'
}

export type LoadingChange = {
  type: 'loading'
  isLoading: boolean
}

export type ReadyChange = {
  type: 'ready'
}

// Layman error reporting back to the user (recoverable errors and warnings)
export type ErrorChange = {
  type: 'error'
  name: string // short computer readable name
  level: 'warning' | 'error'
  description: string
  data?: any
}

export type InvalidValueResolution = null | {
  patches: Patch[]
  description: string
  action: string
  item: PortableTextBlock[] | PortableTextBlock | PortableTextChild | undefined
}

export type InvalidValue = {
  type: 'invalidValue'
  resolution: InvalidValueResolution
  value: PortableTextBlock[]
}

export type UndoChange = {
  type: 'undo'
  patches: Patch[]
  timestamp: Date
}

export type RedoChange = {
  type: 'redo'
  patches: Patch[]
  timestamp: Date
}

export type EditorChange =
  | BlurChange
  | ErrorChange
  | FocusChange
  | InvalidValue
  | LoadingChange
  | MutationChange
  | PatchChange
  | ReadyChange
  | RedoChange
  | SelectionChange
  | ThrottleChange
  | UndoChange
  | UnsetChange
  | ValueChange

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

export type PatchObservable = Observable<Patch>

export type RenderAttributes = {
  focused: boolean
  selected: boolean
  path: Path
  annotations?: PortableTextBlock[]
  style?: string
  listItem?: string
}

export type RenderBlockFunction = (
  value: PortableTextBlock,
  type: Type,
  attributes: RenderAttributes,
  defaultRender: (value: PortableTextBlock) => JSX.Element,
  ref: React.RefObject<HTMLDivElement>
) => JSX.Element

export type RenderChildFunction = (
  value: PortableTextChild,
  type: Type,
  attributes: RenderAttributes,
  defaultRender: (value: PortableTextChild) => JSX.Element,
  ref: React.RefObject<HTMLSpanElement>
) => JSX.Element

export type RenderAnnotationFunction = (
  value: PortableTextBlock,
  type: Type,
  attributes: RenderAttributes,
  defaultRender: () => JSX.Element,
  ref: React.RefObject<HTMLSpanElement>
) => JSX.Element

export type RenderDecoratorFunction = (
  value: string,
  type: {title: string},
  attributes: RenderAttributes,
  defaultRender: () => JSX.Element,
  ref: React.RefObject<HTMLSpanElement>
) => JSX.Element
