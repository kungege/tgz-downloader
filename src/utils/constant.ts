import { LockfileEnum } from '../types'

const defaultConfig = {
  registry: 'https://registry.npmjs.org/',
  directory: './tgz-packages',
}

const fileTypeList: string[] = Object.values(LockfileEnum)

export { defaultConfig, fileTypeList }
