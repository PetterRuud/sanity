import {Node as SlateNode, Operation as SlateOperation} from 'slate'

export type EditorNode = SlateNode & {
  _key: string
  _type: string
  __placeHolderBlock?: true
}

export type EditorOperation = SlateOperation

