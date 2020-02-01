import React, {useState, useEffect} from 'react'
import {PortableTextEditor} from '../../lib'
import {PatchEvent} from '../../lib/PatchEvent'
import {PortableTextType, Type} from '../../lib/types/schema'
import {PortableTextBlock, Block} from '../../lib/types/portableText'
import {ValueContainer, EditorContainer} from '../components/containers'

let key = 0
const keyGenerator = () => {
  return `${new Date().getTime()}-${key++}`
}

const initialPortableText: Block[] = [
  {
    _key: keyGenerator(),
    _type: 'block',
    markDefs: [],
    children: [
      {_key: keyGenerator(), _type: 'span', text: 'This is editable ', marks: []},
      {_key: keyGenerator(), _type: 'span', text: 'rich', marks: ['strong']},
      {_key: keyGenerator(), _type: 'span', text: ' text, ', marks: []},
      {_key: keyGenerator(), _type: 'span', text: 'much', marks: ['em']},
      {_key: keyGenerator(), _type: 'span', text: ' better than a ', marks: []},
      {_key: keyGenerator(), _type: 'span', text: '<textarea>', marks: ['code', 'strong']},
      {_key: keyGenerator(), _type: 'span', text: '!', marks: []}
    ]
  }
]

const getThrouhPropsValue = (): Block[] => {
  return [
    {
      _key: keyGenerator(),
      _type: 'block',
      markDefs: [],
      children: [
        {_key: keyGenerator(), _type: 'span', text: 'Hello at ', marks: []},
        {_key: keyGenerator(), _type: 'span', text: new Date().toISOString(), marks: ['strong']},
        {_key: keyGenerator(), _type: 'span', text: ' from outside props ', marks: []},
      ]
    }
  ]
}

const blockType: PortableTextType = {
  type: 'block',
  styles: [
    {title: 'Normal', value: 'normal'},
    {title: 'H1', value: 'h1'},
    {title: 'H2', value: 'h2'},
    {title: 'H3', value: 'h3'},
    {title: 'H4', value: 'h4'},
    {title: 'H5', value: 'h5'},
    {title: 'H6', value: 'h6'},
    {title: 'Quote', value: 'blockquote'}
  ]
}

const imageType: Type = {
  type: 'image',
  name: 'blockImage'
}

const portableTextType: PortableTextType = {
  type: 'array',
  name: 'body',
  of: [blockType, imageType]
}

const hotkeys = {
  'mod+b': 'strong',
  'mod+i': 'em',
  'mod+´': 'code'
}

/**
 * A basic standalone editor with hotkeys and value inspection
 */
const Standalone = () => {
  const [value, setValue] = useState()
  useEffect(() => {
    if (!value) {
      setValue(initialPortableText)
    }
  })
  const handleChange = (event: PatchEvent, value: PortableTextBlock[] | undefined) => {
    // console.log(JSON.stringify(event, null, 2))
    setValue(value)
  }
  return (
    <div>
      <h2>Portable Text Editor</h2>
      <button onClick={() => setValue(getThrouhPropsValue())}>Set value from props</button>
      <p>Hotkeys: {JSON.stringify(hotkeys)}</p>
      <EditorContainer>
        <PortableTextEditor
          placeholderText="Type here!"
          type={portableTextType}
          onChange={handleChange}
          hotkeys={hotkeys}
          value={value || initialPortableText}
          keyGenerator={keyGenerator}
        />
      </EditorContainer>
      <h3>Editor value:</h3>
      <ValueContainer>{value ? JSON.stringify(value, null, 2) : 'Not set'}</ValueContainer>
    </div>
  )
}

export default Standalone
