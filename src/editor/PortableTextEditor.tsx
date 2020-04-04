import React from 'react'
import {randomKey} from '../utils/randomKey'
import {SlateEditor} from './SlateEditor'
import {compileType} from '../utils/schema'
import {getPortableTextFeatures} from '../utils/getPortableTextFeatures'
import {PortableTextBlock, PortableTextFeatures} from '../types/portableText'
import {Type} from '../types/schema'
import {EditorSelection, EditorChange, OnPasteFn} from '../types/editor'
import {Subject} from 'rxjs'

export const keyGenerator = () => randomKey(12)

export type Props = {
  change$: Subject<EditorChange>
  hotkeys?: {marks: {}}
  keyGenerator?: () => string
  maxBlocks?: number | string
  selection: EditorSelection
  placeholderText?: string
  readOnly?: boolean
  spellCheck?: boolean
  type: Type
  value?: PortableTextBlock[]
  onPaste?: OnPasteFn
}

export class PortableTextEditor extends React.Component<Props, {}> {
  type: Type
  private portableTextFeatures: PortableTextFeatures
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
  }
  focus() {
    this.slateEditorRef.focus()
  }
  render() {
    const {
      change$,
      spellCheck,
      placeholderText,
      maxBlocks,
      hotkeys,
      readOnly,
      value,
      selection,
      onPaste
    } = this.props
    return (
      <SlateEditor
        change$={change$}
        editorRef={slateEditor => (this.slateEditorRef = slateEditor)}
        hotkeys={hotkeys}
        keyGenerator={this.props.keyGenerator || keyGenerator}
        maxBlocks={maxBlocks ? Number(maxBlocks) || undefined : undefined}
        onPaste={onPaste}
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
