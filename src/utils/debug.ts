import debug from 'debug'
export default debug('sanity-pte:')
export function debugWithPrefix(prefix: string) {
  return debug(`sanity-pte:${prefix}`)
}
