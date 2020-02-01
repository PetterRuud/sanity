// import {editorValueToBlocks} from './editorValueToBlocks'
import {set, setIfMissing} from '../PatchEvent'
import {EditorOperation, EditorNode} from '../types/editor'
import {PortableTextFeatures, PortableTextBlock} from '../types/portableText'
import {PortableTextType} from '../types/schema'
// import {InsertPosition, Patch} from '../types/patch'

// function removePlaceholderProp(node) {
//   const {__placeholderBlock, ...rest} = node
//   return rest
// }

export function createOperationToPatches(
  portableTextFeatures: PortableTextFeatures,
  portableTextType: PortableTextType
) {
  // function toBlock(editorValue: EditorNode[], index: number) {
  //   if (!editorValue[index]) {
  //     throw new Error(`No block found at index ${index} in editor value`)
  //   }
  //   return editorValueToBlocks([editorValue[index]], portableTextFeatures)[0]
  // }

  function insertTextPatch(operation: EditorOperation, editorValue: EditorNode[], value: PortableTextBlock[]) {
    const block = editorValue[operation.path[0]]
    return [
      setIfMissing(editorValue),
      set(block, [{_key: block._key}])
    ]
  }

  // eslint-disable-next-line complexity
  return function operationToPatches(
    operation: EditorOperation,
    editorValue: EditorNode[],
    value: PortableTextBlock[]
  ) {
    // console.log('EditorOperation', JSON.stringify(operation, null, 2))
    // console.log('editorValue', JSON.stringify(editorValue, null, 2))
    switch (operation.type) {
      case 'insert_text':
        return insertTextPatch(operation, editorValue, value)
      default:
        return []
    }
  }
}
