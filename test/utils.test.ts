import assert from 'node:assert/strict'
import { buildTarballUrl, getFilePathByPnpm, parsePackageKey } from '../src/utils/utils'

assert.deepEqual(parsePackageKey('vue@3.5.40'), {
  name: 'vue',
  version: '3.5.40',
})

assert.deepEqual(parsePackageKey('@vue/shared@3.5.40'), {
  name: '@vue/shared',
  version: '3.5.40',
})

assert.deepEqual(parsePackageKey('/@vue/shared@3.5.40'), {
  name: '@vue/shared',
  version: '3.5.40',
})

assert.deepEqual(parsePackageKey('/vue/2.7.16'), {
  name: 'vue',
  version: '2.7.16',
})

assert.deepEqual(parsePackageKey('/@vue/shared/3.5.40'), {
  name: '@vue/shared',
  version: '3.5.40',
})

assert.deepEqual(parsePackageKey('vue@3.5.40(typescript@5.9.3)'), {
  name: 'vue',
  version: '3.5.40',
})

assert.deepEqual(
  parsePackageKey(
    'rspack-vue-loader@17.5.0(@rspack/core@2.1.7(@swc/helpers@0.5.23))(@vue/compiler-sfc@3.5.40)',
  ),
  {
    name: 'rspack-vue-loader',
    version: '17.5.0',
  },
)

assert.equal(
  buildTarballUrl('@vue/shared', '3.5.40', 'https://registry.example.com'),
  'https://registry.example.com/@vue%2Fshared/-/shared-3.5.40.tgz',
)

const pnpmUrls = await getFilePathByPnpm(`
lockfileVersion: '9.0'
packages:
  vue@3.5.40(typescript@5.9.3):
    resolution:
      integrity: sha512-test
  '@vue/shared@3.5.40':
    resolution:
      integrity: sha512-test
`, 'https://registry.example.com/npm')

assert.deepEqual(pnpmUrls, [
  'https://registry.example.com/npm/vue/-/vue-3.5.40.tgz',
  'https://registry.example.com/npm/@vue%2Fshared/-/shared-3.5.40.tgz',
])
