import React from 'react'
import {PortableTextBlock} from '../../types/portableText'

type Props = {
  attributes: {}
  annotation: PortableTextBlock
  children: React.ReactNode
}
export function DefaultAnnotation(props: Props) {
  return (
    <span style={{color: 'blue'}} onClick={() => alert(JSON.stringify(props.annotation))}>
      {props.children}
    </span>
  )
}
