import {PortableTextBlock, Block} from '../../src/types/portableText'
import {keyGenerator} from '../keyGenerator'

export const createHelloFromPropsValue = (): PortableTextBlock[] => {
  return [
    {
      _key: keyGenerator(),
      _type: 'block',
      markDefs: [],
      children: [
        {_key: keyGenerator(), _type: 'span', text: 'Hello at ', marks: []},
        {_key: keyGenerator(), _type: 'span', text: new Date().toISOString(), marks: ['strong']},
        {_key: keyGenerator(), _type: 'gotcha', children: [{text: ''}]},
        {_key: keyGenerator(), _type: 'span', text: ' from props change ', marks: []},
      ]
    },
    {
      _key: keyGenerator(),
      _type: 'block',
      markDefs: [],
      children: [
        {_key: keyGenerator(), _type: 'span', text: 'Some more text', marks: []},
      ]
    },
  ]
}

export const initialPortableText: Block[] = [
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
