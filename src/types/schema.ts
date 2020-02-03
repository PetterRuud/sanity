export type Type = {
  type: string
  name?: string
  readOnly?: boolean
  of?: Type[]
  options?: {}
  fields?: Type[]
}

export type PortableTextType = Type & {
  type: string
  options?: {
    editModal: 'fold' | 'modal'
    sortable: boolean
    layout?: 'grid'
  }
  styles?: {title: string, value: string}[]
  of?: Type[]
}
