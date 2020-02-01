import {PortableTextEditor} from '../../lib'
import {PatchEvent} from '../../lib/PatchEvent'
// import {PortableTextType} from '../../lib/types/schema'

const editorStyle = {width: '800px', height: '400px', border: '1px solid black'}

const initialPortableText = [
  {
    _type: 'block',
    markDefs: [],
    children: [
      {_type: 'span', text: 'This is editable '},
      {_type: 'span', text: 'rich', marks: ['strong']},
      {_type: 'span', text: ' text, '},
      {_type: 'span', text: 'much', marks: ['em']},
      {_type: 'span', text: ' better than a '},
      {_type: 'span', text: '<textarea>', marks: ['code', 'strong']},
      {_type: 'span', text: '!'}
    ]
  }
]

const blockType = {
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

const imageType = {
  type: 'image',
  name: 'blockImage'
}

const arrayType = {
  type: 'array',
  name: 'body',
  of: [blockType, imageType]
}

function handleChange(event: PatchEvent) {
  // console.log(event)
}

const Standalone = () => {
  return (
    <div style={editorStyle}>
      <PortableTextEditor
        placeholderText="Type here
        !"
        value={initialPortableText}
        type={arrayType}
        onChange={handleChange}
      />
    </div>
  )
}

export default Standalone
