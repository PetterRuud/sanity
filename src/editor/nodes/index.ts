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
