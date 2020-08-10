import React from 'react'
import {randomKey} from '../utils/randomKey'
import {compileType} from '../utils/schema'
import {getPortableTextFeatures} from '../utils/getPortableTextFeatures'
import {PortableTextBlock, PortableTextFeatures, PortableTextChild} from '../types/portableText'
import {Type} from '../types/schema'
import {Patch} from '../types/patch'
import {Path} from '../types/path'
import {
  EditorSelection,
  EditorChange,
  EditorChanges,
  EditableAPI,
  InvalidValueResolution
} from '../types/editor'
import {Subscription, Subject} from 'rxjs'
import {distinctUntilChanged} from 'rxjs/operators'
import {PortableTextEditorContext} from './hooks/usePortableTextEditor'
import {PortableTextEditorSelectionContext} from './hooks/usePortableTextEditorSelection'
import {PortableTextEditorValueContext} from './hooks/usePortableTextEditorValue'
import {compactPatches} from '../utils/patches'
import {validateValue} from '../utils/validateValue'
import {RawType as RawSchemaType} from '../types/schema'
import {debugWithName} from '../utils/debug'

export const defaultKeyGenerator = () => randomKey(12)

const debug = debugWithName('component:PortableTextEditor')

type Props = {
  keyGenerator?: () => string
  maxBlocks?: number | string
  onChange: (change: EditorChange) => void
  readOnly?: boolean
  selection?: EditorSelection
  type: Type | RawSchemaType
  value: PortableTextBlock[] | undefined
}

type State = {
  invalidValueResolution: InvalidValueResolution
  selection: EditorSelection
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

  private changeSubscription: Subscription
  private pendingPatches: Patch[] = []

  public type: Type | RawSchemaType
  public portableTextFeatures: PortableTextFeatures
  public change$: EditorChanges = new Subject()
  public isThrottling = false
  public editable?: EditableAPI
  public keyGenerator: () => string
  public maxBlocks: number | undefined
  public readOnly: boolean

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

    // Setup keyGenerator (either from props, or default)
    this.keyGenerator = props.keyGenerator || defaultKeyGenerator

    // Validate the Portable Text value
    let state: State = {selection: null, invalidValueResolution: null}
    const validation = validateValue(props.value, this.portableTextFeatures, this.keyGenerator)

    if (props.value && !validation.valid) {
      this.change$.next({type: 'loading', isLoading: false})
      this.change$.next({
        type: 'invalidValue',
        resolution: validation.resolution,
        value: props.value
      })
      state = {...state, invalidValueResolution: validation.resolution}
    }
    this.maxBlocks =
      typeof props.maxBlocks === 'undefined'
        ? undefined
        : parseInt(props.maxBlocks.toString(), 10) || undefined
    this.readOnly = props.readOnly || false
    this.state = state
  }

  componentWillUnmount() {
    this.changeSubscription.unsubscribe()
  }

  componentDidMount() {
    if (!this.state.invalidValueResolution) {
      this.change$.next({type: 'ready'})
    }
  }

  public setEditable = editable => {
    this.editable = {...this.editable, ...editable}
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
      case 'selection':
        this.setState({selection: next.selection})
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
    if (this.state.invalidValueResolution) {
      return this.state.invalidValueResolution.description
    }
    return (
      <PortableTextEditorContext.Provider value={this}>
        <PortableTextEditorValueContext.Provider value={this.props.value}>
          <PortableTextEditorSelectionContext.Provider value={this.state.selection}>
            {this.props.children}
          </PortableTextEditorSelectionContext.Provider>
        </PortableTextEditorValueContext.Provider>
      </PortableTextEditorContext.Provider>
    )
  }
}
