import {flatten, uniq, uniqBy} from 'lodash'
import {normalizeBlock} from '@sanity/block-tools'
import {EditorNode} from '../types/editor'
import {PortableTextFeatures} from '../types/portableText'
import {keyGenerator} from '../editor/PortableTextEditor'

export const BLOCK_DEFAULT_STYLE = 'normal'

function createCustomBlockFromData(block) {
  const {value} = block.data
  if (!value) {
    throw new Error(`Data got no value: ${JSON.stringify(block.data)}`)
  }
  const finalBlock = {...value}
  finalBlock._key = block._key || keyGenerator()
  if (!finalBlock._type) {
    throw new Error(`The block must have a _type: ${JSON.stringify(value)}`)
  }
  return finalBlock
}

function toSanitySpan(node, sanityBlock, spanIndex, portableTextFeatures) {
  const allowedDecorators = portableTextFeatures.decorators.map(decorator => decorator.value)
  if (node.text) {
    const marks = Object.keys(node)
      .filter(key => key !== 'text' && allowedDecorators.includes(key))
    return {
      _type: 'span',
      _key: `${sanityBlock._key}${spanIndex()}`,
      text: node.text,
      marks
    }
  }
  if (node.object === 'inline') {
    const {nodes, data} = node
    const annotations = data.annotations
    const annotationKeys = []
    if (annotations) {
      Object.keys(annotations).forEach(name => {
        const annotation = annotations[name]
        const annotationKey = annotation._key
        if (annotation && annotationKey) {
          // TODO: fix this!
          // sanityBlock.markDefs.push(annotation)
          // annotationKeys.push(annotationKey)
        }
      })
    }
    return flatten(
      nodes.map(nodesNode => {
        if (nodesNode.object !== 'text') {
          throw new Error(`Unexpected non-text child node for inline text: ${nodesNode.object}`)
        }
        if (node.type !== 'span') {
          return node.data.value
        }
        return nodesNode.leaves.map(leaf => ({
          _type: 'span',
          _key: `${sanityBlock._key}${spanIndex()}`,
          text: leaf.text,
          marks: uniq(
            leaf.marks
              .map(mark => mark.type)
              .filter(markType => allowedDecorators.includes(markType))
              .concat(annotationKeys)
          )
        }))
      })
    )
  }
  throw new Error(`Unsupported object ${node.object}`)
}

function toSanityBlock(block, portableTextFeatures, options = {}) {
  // Handle block type
  if (block._type === 'block') {
    const sanityBlock = {
      ...block.data,
      _type: 'block',
      markDefs: []
    }
    let index = 0
    const spanIndex = () => {
      return index++
    }

    sanityBlock._key = block.key || keyGenerator()

    if (!sanityBlock.style) {
      sanityBlock.style = BLOCK_DEFAULT_STYLE
    }
    sanityBlock.children = flatten(
      block.children.map(node => toSanitySpan(node, sanityBlock, spanIndex, portableTextFeatures))
    )
    sanityBlock.markDefs = uniqBy(sanityBlock.markDefs, def => (def as any)._key)
    return sanityBlock
  }

  // Handle block objects
  if (portableTextFeatures.types.blockObjects.map(bObj => bObj.name).includes(block.type)) {
    return createCustomBlockFromData(block)
  }

  // Put the right type back on the block if marked as __unknown from blocksToEditorValue
  if (block.type === '__unknown') {
    block.type = block.data.value._type
    return createCustomBlockFromData({
      ...block,
      type: block.data.value._type
    })
  }

  // A block that is not in the schema, so we don't know what to do with it
  throw new Error(`Unknown block type: '${block._type}'`)
}

export function editorValueToBlocks(
  value: EditorNode[],
  portableTextFeatures: PortableTextFeatures,
  options = {}
) {
  if (!value || !Array.isArray(value)) {
    throw new Error('Value must be an array')
  }
  return value
    .map(node => toSanityBlock(node, portableTextFeatures, options))
    .filter(Boolean)
    .map(block =>
      normalizeBlock(block, {
        allowedDecorators: portableTextFeatures.decorators.map(decorator => decorator.value)
      })
    )
}
