import React, {useCallback, useMemo} from 'react'
import isHotkey from 'is-hotkey'
import {Editor, Text, Range} from 'slate'
import {Editable, Slate, withReact} from 'slate-react'
import {PortableTextBlock, PortableTextFeatures} from '../types/portableText'
import {Subject} from 'rxjs'

import {Patch} from '../types/patch'
import {SlateLeaf} from './SlateLeaf'
import {SlateElement} from './SlateElement'
import {createPortableTextEditor} from './createPortableTextEditor'

const DEFAULT_HOTKEYS = {
  'mod+b': 'strong',
  'mod+i': 'em',
  'mod+u': 'underline',
  'mod+`': 'code'
}

export type Props = {
  keyGenerator: () => string
  value?: PortableTextBlock[]
  onChange: (editor: Editor) => void
  placeholderText?: string
  portableTextFeatures: PortableTextFeatures
  hotkeys?: {marks: {}}
  patchSubject: Subject<{patches: Patch[]; editor: Editor}>
}

export const SlateEditor = function(props: Props) {
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
          patchSubject: props.patchSubject
        })
      ),
    []
  )

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

  const onKeyDown = event => {
    Object.keys(hotkeys).forEach(cat => {
      for (const hotkey in hotkeys[cat]) {
        if (isHotkey(hotkey, event.nativeEvent)) {
          event.preventDefault()
          const mark = hotkeys[cat][hotkey]
          toggleMark(editor, mark)
        }
      }
    })
  }

  const hotkeys = props.hotkeys || DEFAULT_HOTKEYS


  // Test Slate decorations. Highlight the word 'banan'
  const banan = 'banan'
  const decorate = useCallback(
    ([node, path]) => {
      const ranges: Range[] = []

      if (banan && Text.isText(node)) {
        const { text } = node
        const parts = text.split(banan)
        let offset = 0

        parts.forEach((part, i) => {
          if (i !== 0) {
            ranges.push({
              anchor: { path, offset: offset - banan.length },
              focus: { path, offset },
              highlight: true,
            })
          }

          offset = offset + part.length + banan.length
        })
      }
      return ranges
    },
    [banan]
  )

  return (
    <Slate editor={editor} value={value} onChange={handleSlateChange}>
      <Editable
        placeholder={props.placeholderText}
        renderElement={renderElement}
        renderLeaf={renderLeaf}
        onKeyDown={onKeyDown}
        decorate={decorate}
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

function isMarkActive(editor: Editor, mark: string) {
  const existingMarks =
    {
      ...(Editor.marks(editor) || {})
    }.marks || []
  return existingMarks ? existingMarks.includes(mark) : false
}

function toggleMark(editor: Editor, format: string) {
  const isActive = isMarkActive(editor, format)
  if (isActive) {
    Editor.removeMark(editor, format)
  } else {
    Editor.addMark(editor, format, true)
  }
}
