import React from 'react'
type Props = {
  children: React.ReactNode
}
export default function Blockquote(props: Props) {
  return (
    <div>
      <blockquote>{props.children}</blockquote>
    </div>
  )
}
