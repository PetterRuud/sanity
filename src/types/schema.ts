export type Type = {
  type: string
  name?: string
  readOnly?: boolean
}

export type PortableTextType = Type & {
  options?: {
    editModal: 'fold' | 'modal'
    sortable: boolean
    layout?: 'grid'
  }
  of: Type[]
}
