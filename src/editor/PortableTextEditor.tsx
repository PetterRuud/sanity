import React from 'react'
import {randomKey} from '../utils/randomKey'
import {flatten} from 'lodash'
import {SlateEditor} from './SlateEditor'
import {PatchEvent} from '../PatchEvent'
import {compileType} from '../utils/schema'
import {getPortableTextFeatures} from '../utils/getPortableTextFeatures'
import {createOperationToPatches} from '../utils/createOperationToPatches'
import {PortableTextBlock, PortableTextFeatures} from '../types/portableText'
import {PortableTextType} from '../types/schema'
import {EditorOperation} from '../types/editor'

export const keyGenerator = () => randomKey(12)

export type Props = {
  hotkeys?: {}
  keyGenerator?: () => string
  onChange: (arg0: PatchEvent, value: PortableTextBlock[] | undefined) => void
  placeholderText?: string
  type: PortableTextType
  value?: PortableTextBlock[]
}

export class PortableTextEditor extends React.Component<Props, {}> {
  type: PortableTextType
  private portableTextFeatures: PortableTextFeatures
  private operationToPatches
  constructor(props: Props) {
    super(props)
    // Test if we have a compiled schema type, if not, conveniently compile it
    this.type = props.type
    if (!props.type.hasOwnProperty('jsonType')) {
      this.type = compileType(props.type)
    }
    // Get the block types feature set
    this.portableTextFeatures = getPortableTextFeatures(this.type)
    // Create patch and editor operation translation based on this spesific type
    this.operationToPatches = createOperationToPatches()
  }
  private handleSlateEditorChange = (operations: EditorOperation[], nextEditorValue: PortableTextBlock[] | undefined) => {
    const patches = flatten(
      operations.map(operation => this.operationToPatches(operation, nextEditorValue, this.props.value))
    )
    this.props.onChange(PatchEvent.from(patches), nextEditorValue)
  }
  render() {
    return (
      <SlateEditor
        portableTextFeatures={this.portableTextFeatures}
        placeholderText={this.props.placeholderText}
        keyGenerator={this.props.keyGenerator || keyGenerator}
        hotkeys={this.props.hotkeys}
        onChange={this.handleSlateEditorChange}
        value={this.props.value}
      />
    )
  }
}
