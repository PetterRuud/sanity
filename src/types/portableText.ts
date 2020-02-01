import {ComponentType} from 'react'
import {Type as SchemaType} from './schema'

export type PortableTextBlock = {
  _type?: string
  _key?: string
  _ref?: string
}

export type Block = {
  _type: string
  _key: string
  children: Span[]
  markDefs: MarkDef[]
}

export type Span = {
  _key: string
  _type: 'span'
  text: string
  marks: string[]
}

export type MarkDef = {_key: string; _type: string}

export type PortableTextFeature = {
  title: string
  value: string
  blockEditor?: {
    icon?: string | ComponentType<any>
    render?: ComponentType<any>
  }
  type: SchemaType
}

export type PortableTextFeatures = {
  decorators: PortableTextFeature[]
  styles: PortableTextFeature[]
  annotations: PortableTextFeature[]
  lists: PortableTextFeature[]
  types: {
    block: SchemaType
    span: SchemaType
    blockContent: SchemaType
    inlineObjects: SchemaType[]
    blockObjects: SchemaType[]
  }
}
