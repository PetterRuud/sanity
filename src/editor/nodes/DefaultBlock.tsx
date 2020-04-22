import React from 'react'
import {PortableTextBlock} from 'src/types/portableText'

type DefaultBlockProps = {
  block: PortableTextBlock
}

const DefaultBlock = (props: DefaultBlockProps): JSX.Element => {
  return <>{JSON.stringify(props.block)}</>
}

export default DefaultBlock
