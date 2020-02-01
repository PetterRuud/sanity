import React, {useState, useMemo, useCallback, useEffect} from 'react'
import isHotkey from 'is-hotkey'
import {Editor} from 'slate'
import {Slate, Editable, withReact} from 'slate-react'
import {EditorOperation} from '../types/editor'
import {PortableTextFeatures, PortableTextBlock} from '../types/portableText'
import {Leaf} from './SlateLeaf'
import {Element} from './SlateElement'
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
  onChange: (operations: EditorOperation[], value: PortableTextBlock[] | undefined) => void
  placeholderText?: string
  portableTextFeatures: PortableTextFeatures
  hotkeys?: {}
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
  const {portableTextFeatures} = props
  const renderElement = useCallback(
    cProps => <Element {...cProps} portableTextFeatures={portableTextFeatures} />,
    []
  )
  const renderLeaf = useCallback(
    cProps => <Leaf {...cProps} portableTextFeatures={portableTextFeatures} />,
    []
  )

  // Track editor value
  const [value, setValue] = useState(getValue(props.value, createPlaceHolderBlock()))

  // Init Editor
  const editor = useMemo(() => withReact(createPortableTextEditor(portableTextFeatures, props.keyGenerator)), [])

  // TODO: figure out how to deal with props.value
  useEffect(() => {
    if (props.value !== value) {
      setValue(props.value)
      console.log('Set new value')
    }
  })

  const handleSlateChange = (value: any) => {
    setValue(value)
    props.onChange(editor.operations, value)
  }
  const hotkeys = props.hotkeys || DEFAULT_HOTKEYS
  return (
    <Slate editor={editor} value={value} onChange={handleSlateChange}>
      <Editable
        placeholder={props.placeholderText}
        renderElement={renderElement}
        renderLeaf={renderLeaf}
        onKeyDown={event => {
          for (const hotkey in hotkeys) {
            if (isHotkey(hotkey, event.nativeEvent)) {
              event.preventDefault()
              const mark = hotkeys[hotkey]
              toggleMark(editor, mark)
            }
          }
        }}
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
