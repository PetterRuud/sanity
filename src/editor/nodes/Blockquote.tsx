import React from 'react'
type Props = {
  children: React.ReactNode
}
// Blockquotes should have a child node propably, for easier styling)
export default function Blockquote(props: Props) {
  return (
    <div>
      <blockquote>{props.children}</blockquote>
    </div>
  )
}
