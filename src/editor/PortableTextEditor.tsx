import React from 'react'
import {randomKey} from '@sanity/block-tools'
import {flatten} from 'lodash'
import {SlateEditor} from './SlateEditor'
import {PatchEvent} from '../PatchEvent'
import {compileType} from '../utils/schema'
import {getPortableTextFeatures} from '../utils/getPortableTextFeatures'
import {createOperationToPatches} from '../utils/createOperationToPatches'
import {PortableTextBlock, PortableTextFeatures} from '../types/portableText'
import {PortableTextType} from '../types/schema'
import {EditorNode, EditorOperation} from '../types/editor'

export const keyGenerator = () => randomKey(12)

export type Props = {
  value?: PortableTextBlock[]
  type: PortableTextType
  onChange: (arg0: PatchEvent) => void
  placeholderText?: string
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
    this.operationToPatches = createOperationToPatches(this.portableTextFeatures, this.type)
  }
  private handleEditorChange = (operations: EditorOperation[], editorValue: EditorNode[]) => {
    console.log(JSON.stringify(editorValue, null, 2))
    const patches = flatten(
      operations.map(operation => this.operationToPatches(operation, editorValue, this.props.value))
    )
    this.props.onChange(PatchEvent.from(patches))
  }
  render() {
    return (
      <SlateEditor
        portableTextFeatures={this.portableTextFeatures}
        placeholderText={this.props.placeholderText}
        keyGenerator={keyGenerator}
        value={this.props.value}
        onChange={this.handleEditorChange}
      />
    )
  }
}
