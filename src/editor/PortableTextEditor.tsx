import React from 'react'
import {randomKey} from '../utils/randomKey'
import {Editable} from './Editable'
import {compileType} from '../utils/schema'
import {getPortableTextFeatures} from '../utils/getPortableTextFeatures'
import {PortableTextBlock, PortableTextFeatures, PortableTextChild} from '../types/portableText'
import {Type} from '../types/schema'
import {Patch} from '../types/patch'
import {
  EditorSelection,
  EditorChange,
  OnPasteFn,
  OnCopyFn,
  EditorChanges,
  PatchObservable,
  EditableAPI
} from '../types/editor'
import {Subscription, Subject} from 'rxjs'
import {distinctUntilChanged} from 'rxjs/operators'
import {compactPatches} from '../utils/patches'
import {validateValue} from '../utils/validateValue'
import {Type as SchemaType} from '../types/schema'
import {debugWithName} from '../utils/debug'

export const keyGenerator = () => randomKey(12)

const debug = debugWithName('component:PortableTextEditor')

type Props = {
  hotkeys?: {marks: {}}
  incomingPatche$?: PatchObservable
  keyGenerator?: () => string
  maxBlocks?: number | string
  onChange: (change: EditorChange) => void
  onCopy?: OnCopyFn
  onPaste?: OnPasteFn
  placeholderText?: string
  readOnly?: boolean
  renderBlock?: (
    value: PortableTextBlock,
    type: SchemaType,
    ref: React.RefObject<HTMLDivElement>,
    attributes: {focused: boolean; selected: boolean},
    defaultRender: (block: PortableTextBlock) => JSX.Element
  ) => JSX.Element
  renderChild?: (
    value: PortableTextChild,
    type: SchemaType,
    ref: React.RefObject<HTMLSpanElement>,
    attributes: {focused: boolean, selected: boolean},
    defaultRender: (child: PortableTextChild) => JSX.Element
  ) => JSX.Element
  renderEditor?: (editor: JSX.Element) => JSX.Element
  selection?: EditorSelection
  spellCheck?: boolean
  type: Type
  value: PortableTextBlock[] | undefined
}

type State = {
  invalidValue: PortableTextBlock[] | undefined
}

export class PortableTextEditor extends React.Component<Props, State> {
  static focus = (editor: PortableTextEditor) => {
    debug('User focused from the outside')
    editor.editable?.focus()
  }
  static blur = (editor: PortableTextEditor) => {
    debug('User blurred from the outside')
    editor.editable?.blur()
  }
  static toggleMark = (editor: PortableTextEditor, mark: string) => {
    debug(`User toggling mark from the outside`, mark)
    editor.editable?.toggleMark(mark)
  }
  static isMarkActive = (editor: PortableTextEditor, mark: string) =>
    editor.editable?.isMarkActive(mark)
  static select = (editor: PortableTextEditor, selection: EditorSelection | null) => {
    debug(`User setting selection from the outside`, selection)
    editor.editable?.select(selection)
  }
  static getPortableTextFeatures = (editor: PortableTextEditor) => {
    return editor.portableTextFeatures
  }
  static isDragging = (editor: PortableTextEditor) => {
    // debug('drag:todo', editor)
    return false // TODO: - when drag is implemented
  }
  static focusBlock = (editor: PortableTextEditor) => {
    return editor.editable?.focusBlock()
  }
  static focusChild = (editor: PortableTextEditor) => {
    return editor.editable?.focusChild()
  }
  static marks = (editor: PortableTextEditor) => {
    return editor.editable?.marks()
  }
  static insertChild = (
    editor: PortableTextEditor,
    type: Type,
    value?: {[prop: string]: any}
  ) => {
    return editor.editable?.insertChild(type, value)
  }
  static insertBlock = (
    editor: PortableTextEditor,
    type: Type,
    value?: {[prop: string]: any}
  ) => {
    return editor.editable?.insertBlock(type, value)
  }
  static toggleList = (editor: PortableTextEditor, listStyle: string): void => {
    return editor.editable?.toggleList(listStyle)
  }
  static hasBlockStyle = (editor: PortableTextEditor, blockStyle: string) => {
    return editor.editable?.hasBlockStyle(blockStyle)
  }
  static toggleBlockStyle = (editor: PortableTextEditor, blockStyle: string) => {
    return editor.editable?.toggleBlockStyle(blockStyle)
  }

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
      invalidValue = props.value
      this.change$.next({type: 'loading', isLoading: false})
      this.change$.next({
        type: 'invalidValue',
        resolution: validation.resolution,
        value: props.value
      })
    }
    this.state = {invalidValue}
  }

  componentWillUnmount() {
    this.changeSubscription.unsubscribe()
  }

  componentDidMount() {
    this.change$.next({type: 'loading', isLoading: false})
    this.change$.next({type: 'ready'})
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
    if (this.state.invalidValue) {
      return null
    }
    const editable = (
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
        renderBlock={this.props.renderBlock}
        renderChild={this.props.renderChild}
        selection={selection}
        spellCheck={spellCheck}
        value={value}
      />
    )
    return (
      <>
        {renderEditor ? renderEditor(editable) : editable}
      </>
    )
  }
}
