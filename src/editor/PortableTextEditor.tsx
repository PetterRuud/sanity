import React from 'react'
import {randomKey} from '../utils/randomKey'
import {SlateEditor} from './SlateEditor'
import {compileType} from '../utils/schema'
import {getPortableTextFeatures} from '../utils/getPortableTextFeatures'
import {PortableTextBlock, PortableTextFeatures} from '../types/portableText'
import {Type} from '../types/schema'
import {Patch} from '../types/patch'
import {EditorSelection, EditorChange, OnPasteFn, OnCopyFn, EditorChanges} from '../types/editor'
import {Subscription, Subject} from 'rxjs'
import {distinctUntilChanged} from 'rxjs/operators'
import {compactPatches} from '../utils/patches'
import {validateValue} from '../utils/validateValue'

export const keyGenerator = () => randomKey(12)

export type Props = {
  throttle?: boolean
  hotkeys?: {marks: {}}
  keyGenerator?: () => string
  maxBlocks?: number | string
  onChange: (change: EditorChange) => void
  onCopy?: OnCopyFn
  onPaste?: OnPasteFn
  placeholderText?: string
  readOnly?: boolean
  selection: EditorSelection
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
  private slateEditorRef: any
  private change$: EditorChanges = new Subject()
  private changeSubscription: Subscription
  private isThrottling = false
  private pendingPatches: Patch[] = []

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
    this.changeSubscription = this.change$.pipe(distinctUntilChanged()).subscribe(this.handleChange)
    this.change$.next({type: 'loading', isLoading: true})

    // Validate the props value so we don't crash for the user on bad values
    let invalidValue
    const validation = validateValue(
      props.value,
      this.portableTextFeatures,
      this.props.keyGenerator || keyGenerator
    )
    if (props.value && !validation.valid) {
      invalidValue = props.value
      this.change$.next({type: 'loading', isLoading: false})
      this.change$.next({type: 'error', error: 'invalidValue', resolution: validation.resolution})
    }
    this.state = {invalidValue}
  }

  componentWillUnmount() {
    this.changeSubscription.unsubscribe()
  }

  componentDidMount() {
    this.change$.next({type: 'loading', isLoading: false})
  }

  private handleChange = (next: EditorChange): void => {
    const {onChange} = this.props
    switch (next.type) {
      case 'mutation':
        if (!this.isThrottling) {
          onChange({type: 'mutation', patches: compactPatches(this.pendingPatches)})
          this.pendingPatches = []
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
            onChange({
              type: 'mutation',
              patches: compactPatches(this.pendingPatches)
            })
            this.pendingPatches = []
          }
        }
        break
      default:
        onChange(next)
    }
  }

  focus() {
    this.slateEditorRef.focus()
  }
  render() {
    if (this.state.invalidValue) {
      return <div />
    }
    const {
      spellCheck,
      placeholderText,
      maxBlocks,
      hotkeys,
      readOnly,
      value,
      selection,
      onPaste,
      onCopy
    } = this.props
    return (
      <SlateEditor
        change$={this.change$}
        editorRef={slateEditor => (this.slateEditorRef = slateEditor)}
        hotkeys={hotkeys}
        keyGenerator={this.props.keyGenerator || keyGenerator}
        maxBlocks={maxBlocks ? Number(maxBlocks) || undefined : undefined}
        onPaste={onPaste}
        onCopy={onCopy}
        placeholderText={placeholderText}
        portableTextFeatures={this.portableTextFeatures}
        readOnly={readOnly}
        selection={selection}
        spellCheck={spellCheck}
        value={value}
      />
    )
  }
}
