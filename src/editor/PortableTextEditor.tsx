import React from 'react'
import {randomKey} from '../utils/randomKey'
import {Editable} from './Editable'
import {compileType} from '../utils/schema'
import {getPortableTextFeatures} from '../utils/getPortableTextFeatures'
import {PortableTextBlock, PortableTextFeatures, PortableTextChild} from '../types/portableText'
import {Type} from '../types/schema'
import {Patch} from '../types/patch'
import {HotkeyOptions} from '../types/options'
import {Path} from '../types/path'
import {
  EditorSelection,
  EditorChange,
  OnPasteFn,
  OnCopyFn,
  EditorChanges,
  PatchObservable,
  EditableAPI,
  InvalidValueResolution,
  RenderAttributes,
  RenderBlockFunction
} from '../types/editor'
import {Subscription, Subject} from 'rxjs'
import {distinctUntilChanged} from 'rxjs/operators'
import {compactPatches} from '../utils/patches'
import {validateValue} from '../utils/validateValue'
import {Type as SchemaType} from '../types/schema'
import {debugWithName} from '../utils/debug'
import {ErrorBoundary} from './ErrorBoundary'

export const keyGenerator = () => randomKey(12)

const debug = debugWithName('component:PortableTextEditor')

type Props = {
  hotkeys?: HotkeyOptions
  incomingPatche$?: PatchObservable
  keyGenerator?: () => string
  maxBlocks?: number | string
  onChange: (change: EditorChange) => void
  onCopy?: OnCopyFn
  onPaste?: OnPasteFn
  placeholderText?: string
  readOnly?: boolean
  renderAnnotation?: (
    value: PortableTextBlock,
    type: SchemaType,
    ref: React.RefObject<HTMLSpanElement>,
    attributes: RenderAttributes,
    defaultRender: () => JSX.Element
  ) => JSX.Element
  renderDecorator?: (
    value: string,
    type: {title: string},
    ref: React.RefObject<HTMLSpanElement>,
    attributes: RenderAttributes,
    defaultRender: () => JSX.Element
  ) => JSX.Element
  renderBlock?: RenderBlockFunction
  renderChild?: (
    value: PortableTextChild,
    type: SchemaType,
    ref: React.RefObject<HTMLSpanElement>,
    attributes: RenderAttributes,
    defaultRender: (child: PortableTextChild) => JSX.Element
  ) => JSX.Element
  renderEditor?: (editor: JSX.Element) => JSX.Element
  selection?: EditorSelection
  spellCheck?: boolean
  type: Type
  value: PortableTextBlock[] | undefined
}

type State = {
  invalidValueResolution: InvalidValueResolution
}

// TODO: try to break this component in parts, as it's getting pretty big.
export class PortableTextEditor extends React.Component<Props, State> {
  static focus = (editor: PortableTextEditor): void => {
    debug('Host requesting focus')
    editor.editable?.focus()
  }
  static blur = (editor: PortableTextEditor): void => {
    debug('Host blurred')
    editor.editable?.blur()
  }
  static toggleMark = (editor: PortableTextEditor, mark: string): void => {
    debug(`Host toggling mark`, mark)
    editor.editable?.toggleMark(mark)
  }
  static isMarkActive = (editor: PortableTextEditor, mark: string) =>
    editor.editable?.isMarkActive(mark)
  static select = (editor: PortableTextEditor, selection: EditorSelection | null) => {
    debug(`Host setting selection`, selection)
    editor.editable?.select(selection)
  }
  static getPortableTextFeatures = (editor: PortableTextEditor) => {
    return editor.portableTextFeatures
  }
  static isDragging = (editor: PortableTextEditor) => {
    return editor.editable?.isDragging()
  }
  static getSelection = (editor: PortableTextEditor) => {
    return editor.editable?.getSelection()
  }
  static focusBlock = (editor: PortableTextEditor) => {
    return editor.editable?.focusBlock()
  }
  // Query what is the focus child?
  static focusChild = (editor: PortableTextEditor): PortableTextChild | undefined => {
    return editor.editable?.focusChild()
  }
  static marks = (editor: PortableTextEditor) => {
    return editor.editable?.marks()
  }
  static insertChild = (
    editor: PortableTextEditor,
    type: Type,
    value?: {[prop: string]: any}
  ): Path | undefined => {
    debug(`Host inserting child`)
    return editor.editable?.insertChild(type, value)
  }
  static insertBlock = (
    editor: PortableTextEditor,
    type: Type,
    value?: {[prop: string]: any}
  ): Path | undefined => {
    return editor.editable?.insertBlock(type, value)
  }
  static toggleList = (editor: PortableTextEditor, listStyle: string): void => {
    return editor.editable?.toggleList(listStyle)
  }
  static hasBlockStyle = (editor: PortableTextEditor, blockStyle: string) => {
    return editor.editable?.hasBlockStyle(blockStyle)
  }
  static toggleBlockStyle = (editor: PortableTextEditor, blockStyle: string) => {
    debug(`Host is toggling block style`)
    return editor.editable?.toggleBlockStyle(blockStyle)
  }
  static isVoid = (editor: PortableTextEditor, element: PortableTextBlock | PortableTextChild) => {
    return editor.editable?.isVoid(element)
  }
  static findDOMNode = (
    editor: PortableTextEditor,
    element: PortableTextBlock | PortableTextChild
  ) => {
    return editor.editable?.findDOMNode(element)
  }
  static findByPath = (editor: PortableTextEditor, path: Path) => {
    debug(`Host is finding by path`)
    return editor.editable?.findByPath(path)
  }
  static activeAnnotations = (editor: PortableTextEditor): PortableTextBlock[] => {
    return editor && editor.editable ? editor.editable.activeAnnotations() : []
  }
  static addAnnotation = (
    editor: PortableTextEditor,
    type: Type,
    value?: {[prop: string]: any}
  ): {spanPath: Path; markDefPath: Path} | undefined => editor.editable?.addAnnotation(type, value)
  static removeAnnotation = (editor: PortableTextEditor, type: Type) =>
    editor.editable?.removeAnnotation(type)
  static remove = (
    editor: PortableTextEditor,
    selection: EditorSelection,
    options?: {mode?: 'block' | 'children'}
  ) => editor.editable?.remove(selection, options)

  private portableTextFeatures: PortableTextFeatures
  private editable?: EditableAPI
  private change$: EditorChanges = new Subject()
  private changeSubscription: Subscription
  private isThrottling = false
  private pendingPatches: Patch[] = []
  private type: Type

  constructor(props: Props) {
    super(props)
    // Test if we have a compiled schema type, if not, conveniently compile it
    this.type = props.type
    if (!props.type.hasOwnProperty('jsonType')) {
      this.type = compileType(props.type)
    }
    // Indicate that we are loading
    this.change$.next({type: 'loading', isLoading: true})

    // Get the block types feature set (lookup table)
    this.portableTextFeatures = getPortableTextFeatures(this.type)

    // Subscribe to (distinct) changes
    this.changeSubscription = this.change$.pipe(distinctUntilChanged()).subscribe(this.onChange)

    // Validate the Portable Text value
    let invalidValue
    const validation = validateValue(
      props.value,
      this.portableTextFeatures,
      this.props.keyGenerator || keyGenerator
    )
    if (props.value && !validation.valid) {
      this.change$.next({type: 'loading', isLoading: false})
      invalidValue = {
        type: 'invalidValue',
        resolution: validation.resolution,
        value: props.value
      }
      this.change$.next(invalidValue)
      this.state = {invalidValueResolution: validation.resolution}
    }
    this.state = this.state || {}
  }

  componentWillUnmount() {
    this.changeSubscription.unsubscribe()
  }

  componentDidMount() {
    if (!this.state.invalidValueResolution) {
      this.change$.next({type: 'ready'})
      this.change$.next({type: 'selection', selection: this.props.selection || null})
    }
  }

  private onChange = (next: EditorChange): void => {
    const {onChange} = this.props
    const flush = () => {
      this.isThrottling = false
      const finalPatches = compactPatches(this.pendingPatches)
      if (finalPatches.length) {
        onChange({type: 'mutation', patches: finalPatches})
      }
      this.pendingPatches = []
    }
    switch (next.type) {
      case 'mutation':
        if (!this.isThrottling) {
          flush()
        } else {
          this.pendingPatches = [...this.pendingPatches, ...next.patches]
        }
        break
      case 'throttle':
        if (next.throttle) {
          this.isThrottling = true
        } else {
          this.isThrottling = false
          if (this.pendingPatches.length > 0) {
            flush()
          }
        }
        break
      case 'undo':
      case 'redo':
        flush()
        onChange(next)
        break
      case 'unset':
      default:
        onChange(next)
    }
  }

  handleEditableError = error => {
    debug('Catched error', error)
    console.error(error)
  }

  render() {
    const {
      hotkeys,
      maxBlocks,
      incomingPatche$,
      onCopy,
      onPaste,
      placeholderText,
      readOnly,
      renderEditor,
      selection,
      spellCheck,
      value
    } = this.props
    if (this.state.invalidValueResolution) {
      return this.state.invalidValueResolution.description
    }
    const editable = (
      <ErrorBoundary onError={this.handleEditableError}>
        <Editable
          change$={this.change$}
          editable={editable => (this.editable = editable)}
          hotkeys={hotkeys}
          incomingPatche$={incomingPatche$}
          isThrottling={this.isThrottling}
          keyGenerator={this.props.keyGenerator || keyGenerator}
          maxBlocks={maxBlocks ? Number(maxBlocks) || undefined : undefined}
          onPaste={onPaste}
          onCopy={onCopy}
          placeholderText={value === undefined ? placeholderText : undefined}
          portableTextFeatures={this.portableTextFeatures}
          readOnly={readOnly}
          renderAnnotation={this.props.renderAnnotation}
          renderBlock={this.props.renderBlock}
          renderChild={this.props.renderChild}
          renderDecorator={this.props.renderDecorator}
          selection={selection}
          spellCheck={spellCheck}
          value={value}
        />
      </ErrorBoundary>
    )
    if (renderEditor) {
      return renderEditor(editable)
    }
    return editable
  }
}
