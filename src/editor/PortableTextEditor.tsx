import React from 'react'
import {Editor} from 'slate'
import {randomKey} from '../utils/randomKey'
import {SlateEditor} from './SlateEditor'
import {PatchEvent} from '../patch/PatchEvent'
import {compileType} from '../utils/schema'
import {toSlateValue} from '../utils/toSlateValue'
import {toPortableTextRange} from '../utils/selection'
import {compactPatches} from '../utils/patches'
import {getPortableTextFeatures} from '../utils/getPortableTextFeatures'
import {PortableTextBlock, PortableTextFeatures} from '../types/portableText'
import {PortableTextType} from '../types/schema'
import {Patch} from '../types/patch'
import {EditorSelection} from '../types/editor'
import {Subject} from 'rxjs'

export const keyGenerator = () => randomKey(12)

export type Props = {
  hotkeys?: {marks: {}}
  keyGenerator?: () => string
  maxBlocks?: number | string
  onChange: (arg0: PatchEvent, value: PortableTextBlock[] | undefined) => void
  onSelectionChange?: (selection: EditorSelection) => void
  selection: EditorSelection
  placeholderText?: string
  readOnly?: boolean
  spellCheck?: boolean
  type: PortableTextType
  value?: PortableTextBlock[]
}

const patchSubject = new Subject<{patches: Patch[]; editor: Editor}>()

export class PortableTextEditor extends React.Component<Props, {}> {
  type: PortableTextType
  private portableTextFeatures: PortableTextFeatures
  private patchSubscriber: any
  private pendingPatches: Patch[]
  private slateEditorRef: any
  constructor(props: Props) {
    super(props)
    // Test if we have a compiled schema type, if not, conveniently compile it
    this.type = props.type
    if (!props.type.hasOwnProperty('jsonType')) {
      this.type = compileType(props.type)
    }
    // Get the block types feature set
    this.portableTextFeatures = getPortableTextFeatures(this.type)
    this.pendingPatches = []
    this.patchSubscriber = patchSubject.subscribe({
      next: val => {
        this.pendingPatches = [...this.pendingPatches, ...val.patches]
      }
    })
  }
  private handleSelectionChange(editor: Editor) {
    const {onSelectionChange} = this.props
    if (onSelectionChange) {
      onSelectionChange(toPortableTextRange(editor))
    }
  }
  private handleEditorChange = (editor: Editor) => {
    this.props.onChange(PatchEvent.from(compactPatches(this.pendingPatches)), editor.children)
    this.handleSelectionChange(editor)
    this.pendingPatches = []
  }
  componentWillUnmount() {
    this.patchSubscriber.unsubscribe()
  }
  focus() {
    this.slateEditorRef.focus()
  }
  render() {
    const {spellCheck, placeholderText, maxBlocks, hotkeys, readOnly, value, selection} = this.props
    return (
      <SlateEditor
        editorRef={slateEditor => (this.slateEditorRef = slateEditor)}
        hotkeys={hotkeys}
        keyGenerator={this.props.keyGenerator || keyGenerator}
        maxBlocks={maxBlocks ? Number(maxBlocks) || undefined : undefined}
        onChange={this.handleEditorChange}
        patchSubject={patchSubject}
        placeholderText={placeholderText}
        portableTextFeatures={this.portableTextFeatures}
        readOnly={readOnly}
        spellCheck={spellCheck}
        value={toSlateValue(value, this.portableTextFeatures.types.block.name)}
        selection={selection}
      />
    )
  }
}
