import {isEqual} from 'lodash'
import React, {useCallback, useMemo, useEffect} from 'react'
import {Editor, Text, Range, Transforms, Node} from 'slate'
import {Editable, Slate, withReact, ReactEditor} from 'slate-react'
import {PortableTextFeatures} from '../types/portableText'
import {EditorSelection} from '../types/editor'
import {Subject} from 'rxjs'

import {Patch} from '../types/patch'
import {SlateLeaf} from './SlateLeaf'
import {SlateElement} from './SlateElement'
import {createPortableTextEditor} from './createPortableTextEditor'
import {toSlateRange} from '../utils/selection'

export type Props = {
  editorRef: any
  hotkeys?: {marks: {}}
  keyGenerator: () => string
  maxBlocks?: number
  onChange: (editor: Editor) => void
  patchSubject: Subject<{patches: Patch[]; editor: Editor}>
  placeholderText?: string
  portableTextFeatures: PortableTextFeatures
  readOnly?: boolean
  spellCheck?: boolean
  value: Node[] | undefined
  selection: EditorSelection
}

export const SlateEditor = (props: Props) => {
  const createPlaceHolderBlock = () => [
    {
      _type: portableTextFeatures.types.block.name,
      _key: props.keyGenerator(),
      style: 'normal',
      markDefs: [],
      children: [
        {
          _type: 'span',
          _key: props.keyGenerator(),
          text: '',
          marks: []
        }
      ]
    }
  ]
  const {portableTextFeatures, keyGenerator} = props

  // Track editor value
  const value = getValue(props.value, createPlaceHolderBlock())

  // Init Editor
  const editor = useMemo(
    () =>
      withReact(
        createPortableTextEditor({
          portableTextFeatures,
          keyGenerator,
          patchSubject: props.patchSubject,
          maxBlocks: props.maxBlocks,
          hotkeys: props.hotkeys
        })
      ),
    []
  )

  props.editorRef({editor, focus: () => ReactEditor.focus(editor)})

  const renderElement = useCallback(
    cProps => <SlateElement {...cProps} portableTextFeatures={portableTextFeatures} />,
    []
  )
  const renderLeaf = useCallback(
    cProps => <SlateLeaf {...cProps} portableTextFeatures={portableTextFeatures} />,
    []
  )

  const handleSlateChange = () => {
    props.onChange(editor)
  }

  // Test Slate decorations. Highlight the word 'banan'
  // TODO: remove this
  const banan = 'banan'
  const decorate = useCallback(
    ([node, path]) => {
      const ranges: Range[] = []

      if (banan && Text.isText(node)) {
        const {text} = node
        const parts = text.split(banan)
        let offset = 0

        parts.forEach((part, i) => {
          if (i !== 0) {
            ranges.push({
              anchor: {path, offset: offset - banan.length},
              focus: {path, offset},
              highlight: true
            })
          }

          offset = offset + part.length + banan.length
        })
      }
      return ranges
    },
    [banan]
  )

  // Set the selection according to props
  useEffect(() => {
    if (props.selection) {
      const range = toSlateRange(props.selection, props.value)
      if (range && !isEqual(range, editor.selection)) {
        Transforms.select(editor, range)
        editor.onChange()
      }
    }
  }, [props.selection])

  return (
    <Slate
      selection={toSlateRange(props.selection, props.value) || editor.selection}
      editor={editor}
      value={value}
      onChange={handleSlateChange}
    >
      <Editable
        decorate={decorate}
        onKeyDown={event => editor.pteWithHotKeys(editor, event)}
        placeholder={props.placeholderText}
        readOnly={props.readOnly}
        renderElement={renderElement}
        renderLeaf={renderLeaf}
        spellCheck={props.spellCheck}
      />
    </Slate>
  )
}

function getValue(propsValue, initialValue) {
  if (Array.isArray(propsValue) && propsValue.length > 0) {
    return propsValue
  }
  return initialValue
}
