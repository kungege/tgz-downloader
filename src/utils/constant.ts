import { LockfileEnum } from '../types'

const defaultConfig = {
  registry: 'https://registry.npm.taobao.org/',
  directory: './tgz-packages',
}

const fileTypeList: string[] = Object.values(LockfileEnum)

export { defaultConfig, fileTypeList }
