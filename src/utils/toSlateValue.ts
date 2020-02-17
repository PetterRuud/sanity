export function toSlateValue(value, textBlockType) {
  if (value && Array.isArray(value)) {
    return value.map(blk => {
      const isPortableText = blk._type === textBlockType
      if (isPortableText) {
        return blk
      }
      const {_type, _key, ...rest} = blk
      return {_type, _key, children: [{text: ''}], value: rest}
    })
  }
  return value
}


export function fromSlateValue(value, textBlockType) {
  if (value && Array.isArray(value)) {
    return value.map(blk => {
      const isPortableText = blk._type === textBlockType
      if (isPortableText) {
        return blk
      }
      const {_key, _type} = blk
      return {_key, _type, ...blk.value}
    })
  }
  return value
}
