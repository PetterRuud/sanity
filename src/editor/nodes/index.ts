import styled from 'styled-components'

function getHeaderSize(type: string) {
  switch(type) {
    case 'h1':
      return  '4em'
    default:
      return `1em`
  }
}

export const TextBlock = styled.div`
  font-size: 1em;
  font-weight: 400;
  width: 100%;
  line-height: 1.5em;
  margin-bottom: 0.5em;
  border: 1px solid #eee;
`

export const ListItem = styled.div`
  font-size: inherit;
`

export const ListItemInner = styled.div`
  font-size: inherit;
`

export const Normal = styled.div`
  font-size: inherit;
`
export const Header = styled.div`
  font-size: ${props => getHeaderSize(props.type)};
`

export const Strong = styled.span`
  font-weight: 700;
`
export const Em = styled.span`
  font-style: italic;
`

export const Code = styled.code`
`

export const BlockObject = styled.div`
  padding: 1em;
  background: #eee;
  position: relative;
  border: ${props => {
    if (props.focused) {
      return '1px solid red'
    }
    if (props.selected) {
      return '1px solid red'
    }
    return 'none'
  }};
`

export const InlineObject = styled.span`
  background: #999;
  border: ${props => {
    if (props.focused) {
      return '1px solid red'
    }
    if (props.selected) {
      return '1px solid red'
    }
    return 'none'
  }};
`
