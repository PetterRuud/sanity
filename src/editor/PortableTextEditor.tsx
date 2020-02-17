import React from 'react'
import {Editor} from 'slate'
import {randomKey} from '../utils/randomKey'
import {SlateEditor} from './SlateEditor'
import {PatchEvent} from '../patch/PatchEvent'
import {compileType} from '../utils/schema'
import {compactPatches} from '../utils/patches'
import {getPortableTextFeatures} from '../utils/getPortableTextFeatures'
import {PortableTextBlock, PortableTextFeatures} from '../types/portableText'
import {PortableTextType} from '../types/schema'
import {Patch} from '../types/patch'
import {Subject} from 'rxjs'

export const keyGenerator = () => randomKey(12)

export type Props = {
  hotkeys?: {marks: {}}
  keyGenerator?: () => string
  maxBlocks?: number | string
  onChange: (arg0: PatchEvent, value: PortableTextBlock[] | undefined) => void
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
  private handleEditorChange = (editor: Editor) => {
    this.props.onChange(PatchEvent.from(compactPatches(this.pendingPatches)), editor.children)
    this.pendingPatches = []
  }
  componentWillUnmount() {
    this.patchSubscriber.unsubscribe()
  }
  render() {
    const {value, spellCheck, placeholderText, maxBlocks, hotkeys, readOnly} = this.props
    return (
      <SlateEditor
        hotkeys={hotkeys}
        keyGenerator={this.props.keyGenerator || keyGenerator}
        maxBlocks={maxBlocks ? Number(maxBlocks) || undefined : undefined}
        onChange={this.handleEditorChange}
        patchSubject={patchSubject}
        placeholderText={placeholderText}
        portableTextFeatures={this.portableTextFeatures}
        readOnly={readOnly}
        spellCheck={spellCheck}
        value={value}
      />
    )
  }
}
