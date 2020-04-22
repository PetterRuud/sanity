import {toSlateValue} from '../../src/utils/values'

it('checks undefined', () => {
  const result = toSlateValue(undefined, 'image')
  expect(result).toHaveLength(0)
})

it('runs given empty array', () => {
  const result = toSlateValue([], 'image')
  expect(result).toHaveLength(0)
})

it('given type is custom', () => {
  const result = toSlateValue([{
    _type: 'image',
    _key: '123',
  }], 'block')
  expect(result).toMatchObject([{
    _key: "123",
    _type: "image",
    children: [
      {
        text: ""
      }
    ],
    value: {}
  }])
})
