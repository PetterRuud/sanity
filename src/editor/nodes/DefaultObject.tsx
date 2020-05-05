import React from 'react'
import {PortableTextBlock, PortableTextChild} from 'src/types/portableText'

type Props = {
  value: PortableTextBlock | PortableTextChild
}

const DefaultObject = (props: Props): JSX.Element => {
  return <>{JSON.stringify(props.value)}</>
}

export default DefaultObject
