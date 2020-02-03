import React from 'react'
import {Editor} from 'slate'
import {randomKey} from '../utils/randomKey'
import {SlateEditor} from './SlateEditor'
import {PatchEvent} from '../PatchEvent'
import {compileType} from '../utils/schema'
import {getPortableTextFeatures} from '../utils/getPortableTextFeatures'
import {PortableTextBlock, PortableTextFeatures} from '../types/portableText'
import {PortableTextType} from '../types/schema'
import {Patch} from '../types/patch'
import {Subject} from 'rxjs'
import {setIfMissing} from '../utils/patches'

export const keyGenerator = () => randomKey(12)

export type Props = {
  hotkeys?: {marks: {}}
  keyGenerator?: () => string
  onChange: (arg0: PatchEvent, value: PortableTextBlock[] | undefined) => void
  placeholderText?: string
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
    let patches = this.pendingPatches
    if (!this.props.value) {
      patches = [setIfMissing(editor.children, []), ...patches]
    }
    this.props.onChange(PatchEvent.from(patches), editor.children)
    this.pendingPatches = []
  }
  componentWillUnmount() {
    this.patchSubscriber.unsubscribe()
  }
  render() {
    return (
      <SlateEditor
        portableTextFeatures={this.portableTextFeatures}
        placeholderText={this.props.placeholderText}
        keyGenerator={this.props.keyGenerator || keyGenerator}
        hotkeys={this.props.hotkeys}
        onChange={this.handleEditorChange}
        value={this.props.value}
        patchSubject={patchSubject}
      />
    )
  }
}
