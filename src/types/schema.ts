export type Type = {
  type: string
  name: string
  title?: string
  description?: string
  readOnly?: boolean
  of?: Type[]
  options?: {}
  fields?: Type[]
}

export type PortableTextType = Type & {
  options?: {
    editModal: 'fold' | 'modal'
    sortable: boolean
    layout?: 'grid'
  }
  styles?: {title: string, value: string}[]
}
