import React from 'react'
import {randomKey} from '../utils/randomKey'
import {Editable} from './Editable'
import {compileType} from '../utils/schema'
import {getPortableTextFeatures} from '../utils/getPortableTextFeatures'
import {PortableTextBlock, PortableTextFeatures, PortableTextChild} from '../types/portableText'
import {Type} from '../types/schema'
import {Patch} from '../types/patch'
import {EditorSelection, EditorChange, OnPasteFn, OnCopyFn, EditorChanges} from '../types/editor'
import {Subscription, Subject} from 'rxjs'
import {distinctUntilChanged} from 'rxjs/operators'
import {compactPatches} from '../utils/patches'
import {validateValue} from '../utils/validateValue'
import {setIfMissing} from '../patch/PatchEvent'

export const keyGenerator = () => randomKey(12)

export type Props = {
  hotkeys?: {marks: {}}
  keyGenerator?: () => string
  maxBlocks?: number | string
  onChange: (change: EditorChange) => void
  onCopy?: OnCopyFn
  onPaste?: OnPasteFn
  placeholderText?: string
  readOnly?: boolean
  renderBlock?: (
    block: PortableTextBlock,
    attributes: {focused: boolean; selected: boolean}
  ) => JSX.Element
  renderChild?: (
    child: PortableTextChild,
    attributes: {focused: boolean; selected: boolean}
  ) => JSX.Element
  searchAndReplace?: boolean
  selection: EditorSelection
  singleUserUndoRedo?: boolean
  spellCheck?: boolean
  type: Type
  value: PortableTextBlock[] | undefined
}

type State = {
  invalidValue: PortableTextBlock[] | undefined
}

export class PortableTextEditor extends React.Component<Props, State> {
  type: Type
  private portableTextFeatures: PortableTextFeatures
  private editor: any
  private change$: EditorChanges = new Subject()
  private changeSubscription: Subscription
  private isThrottling = false
  private pendingPatches: Patch[] = []
  private placeholderValue: PortableTextBlock[] | undefined

  constructor(props: Props) {
    super(props)
    // Test if we have a compiled schema type, if not, conveniently compile it
    this.type = props.type
    if (!props.type.hasOwnProperty('jsonType')) {
      this.type = compileType(props.type)
    }
    // Indicate that we are loading
    this.change$.next({type: 'loading', isLoading: true})

    // Get the block types feature set
    this.portableTextFeatures = getPortableTextFeatures(this.type)

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
      this.change$.next({type: 'invalidValue', resolution: validation.resolution})
    }
    // Subscribe to (distinct) changes
    this.changeSubscription = this.change$.pipe(distinctUntilChanged()).subscribe(this.onChange)
    this.state = {invalidValue}
  }

  componentWillUnmount() {
    this.changeSubscription.unsubscribe()
  }

  componentDidMount() {
    this.change$.next({type: 'loading', isLoading: false})
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
      case 'unset':
        this.placeholderValue = next.placeholderValue
        break
      case 'undo':
      case 'redo':
        // Make sure to flush any pending mutations before emitting the undo
        flush()
        // If the value was unset and we are trying to undo, restore the content
        // TODO: this could propbably be better
        if (
          this.placeholderValue &&
          ((this.props.value && this.props.value.length === 0) || !this.props.value)
        ) {
          next.patches = [setIfMissing(this.placeholderValue, []), ...next.patches]
        }
        if (next.patches.length > 0) {
          onChange(next)
        }
        // Emit the new selection
        onChange({type: 'selection', selection: next.selection})
        break
      default:
        onChange(next)
    }
  }
  focus() {
    this.editor.focus()
  }
  getPortableTextFeatures() {
    return this.portableTextFeatures
  }
  render() {
    if (this.state.invalidValue) {
      return null
    }
    const {
      hotkeys,
      maxBlocks,
      onCopy,
      onPaste,
      placeholderText,
      readOnly,
      searchAndReplace,
      selection,
      singleUserUndoRedo,
      spellCheck,
      value
    } = this.props
    return (
      <Editable
        change$={this.change$}
        editorRef={slateEditor => (this.editor = slateEditor)}
        hotkeys={hotkeys}
        keyGenerator={this.props.keyGenerator || keyGenerator}
        maxBlocks={maxBlocks ? Number(maxBlocks) || undefined : undefined}
        onPaste={onPaste}
        onCopy={onCopy}
        placeholderText={placeholderText}
        portableTextFeatures={this.portableTextFeatures}
        readOnly={readOnly}
        renderBlock={this.props.renderBlock}
        renderChild={this.props.renderChild}
        searchAndReplace={searchAndReplace}
        selection={selection}
        singleUserUndoRedo={singleUserUndoRedo}
        spellCheck={spellCheck}
        value={value}
      />
    )
  }
}
