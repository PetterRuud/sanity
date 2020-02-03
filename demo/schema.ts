import {PortableTextType, Type} from '../src/types/schema'

export const imageType: Type = {
  type: 'image',
  name: 'blockImage'
}

export const gotcha: Type = {
  type: 'object',
  name: 'gotcha',
  fields: [{type: 'string', name: 'title'}]
}

export const blockType: PortableTextType = {
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
  ],
  of: [gotcha]
}

export const portableTextType: PortableTextType = {
  type: 'array',
  name: 'body',
  of: [blockType, gotcha]
}
