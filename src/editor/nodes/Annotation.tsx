import React from 'react'
import {PortableTextBlock} from 'src/types/portableText'

type Props = {
  attributes: {}
  annotation: PortableTextBlock
  children: React.ReactNode
}
export default function AnnotationComponent(props: Props) {
  return (
    <span style={{color: 'blue'}} onClick={() => alert(JSON.stringify(props.annotation))}>
      {props.children}
    </span>
  )
}
