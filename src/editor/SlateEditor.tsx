import React, {useCallback, useMemo, useState, useEffect} from 'react'
import {Editable, Slate, withReact, ReactEditor} from 'slate-react'
import {toSlateRange} from '../utils/selection'
import {PortableTextFeatures, PortableTextBlock} from '../types/portableText'
import {EditorSelection, EditorChange} from '../types/editor'
import {toSlateValue} from '../utils/toSlateValue'
import {Subject} from 'rxjs'

import {SlateLeaf} from './SlateLeaf'
import {SlateElement} from './SlateElement'
import {createPortableTextEditor} from './createPortableTextEditor'
import {toPortableTextRange, normalizeSelection} from '../utils/selection'

type Props = {
  editorRef: any
  hotkeys?: {marks: {}}
  keyGenerator: () => string
  maxBlocks?: number
  changes: Subject<EditorChange>
  placeholderText?: string
  portableTextFeatures: PortableTextFeatures
  readOnly?: boolean
  spellCheck?: boolean
  value?: PortableTextBlock[] | undefined
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
  const {portableTextFeatures, keyGenerator, editorRef} = props

  // Init Editor
  const editor = useMemo(
    () =>
      withReact(
        createPortableTextEditor({
          portableTextFeatures,
          keyGenerator,
          changes: props.changes,
          maxBlocks: props.maxBlocks,
          hotkeys: props.hotkeys
        })
      ),
    []
  )

  // Track editor value
  const value = getValue(props.value, createPlaceHolderBlock())
  const [stateValue, setStateValue] = useState(value)

  // Track selection
  const [selection, setSelection] = useState(editor.selection)

  editorRef({editor, focus: () => ReactEditor.focus(editor)})

  const renderElement = useCallback(
    cProps => <SlateElement {...cProps} portableTextFeatures={portableTextFeatures} />,
    []
  )
  const renderLeaf = useCallback(
    cProps => <SlateLeaf {...cProps} portableTextFeatures={portableTextFeatures} />,
    []
  )

  const handleChange = val => {
    setStateValue(val)
    setSelection(editor.selection)
    props.changes.next({type: 'selection', selection: toPortableTextRange(editor)})
  }

  // Test Slate decorations. Highlight the word 'banan'
  // TODO: remove this
  // const banan = 'banan'
  // const decorate = useCallback(
  //   ([node, path]) => {
  //     const ranges: Range[] = []

  //     if (banan && Text.isText(node)) {
  //       const {text} = node
  //       const parts = text.split(banan)
  //       let offset = 0

  //       parts.forEach((part, i) => {
  //         if (i !== 0) {
  //           ranges.push({
  //             anchor: {path, offset: offset - banan.length},
  //             focus: {path, offset},
  //             highlight: true
  //           })
  //         }

  //         offset = offset + part.length + banan.length
  //       })
  //     }
  //     return ranges
  //   },
  //   [banan]
  // )

  // Restore value from props
  useEffect(() => {
    const slateValueFromProps = toSlateValue(props.value, portableTextFeatures.types.block.name)
    setStateValue(slateValueFromProps)
  }, [props.value])

  // Restore selection from props
  useEffect(() => {
    const pSelection = props.selection
    if (props.selection) {
      const normalizedSelection = normalizeSelection(pSelection, props.value)
      if (normalizedSelection) {
        const slateRange = toSlateRange(normalizedSelection, props.value)
        setSelection(slateRange)
      } else {
        setSelection({anchor: {path: [0, 0], offset: 0}, focus: {path: [0, 0], offset: 0}})
      }
    }
  }, [props.value])

  return (
    <Slate
      onChange={handleChange}
      editor={editor}
      selection={selection}
      value={getValue(stateValue, createPlaceHolderBlock())}
    >
      <Editable
        // decorate={decorate}
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
