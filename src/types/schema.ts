export type Type = {
  type: string
  name?: string
  readOnly?: boolean
  of?: Type[]
  options?: {}
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
