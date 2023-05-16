import lockfile from '@yarnpkg/lockfile'
import type { YarnNpmPkgParam } from '../types'

export async function getFilePathByYarn(file: string): Promise<string[]> {
  const { object } = lockfile.parse(file)
  const yarnpkgInfo: YarnNpmPkgParam[] = Object.values(JSON.parse(JSON.stringify(object)))
  return Promise.resolve([...new Set(yarnpkgInfo.map(item => item.resolved))])
}
export async function getFilePathByNpm(file: string): Promise<string[]> {
  const npmpkgInfo: YarnNpmPkgParam[] = (Object.values(JSON.parse(file).dependencies))
  return Promise.resolve([...new Set(npmpkgInfo.map(item => item.resolved))])
}
