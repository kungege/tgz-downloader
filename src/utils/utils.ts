import type { PnpmPkgParam, YarnNpmPkgParam } from '../types'
import lockfile from '@yarnpkg/lockfile'
import { parse } from 'yaml'
import { defaultConfig } from './constant'

export async function getFilePathByYarn(file: string): Promise<string[]> {
  const { object } = lockfile.parse(file)
  const yarnpkgInfo: YarnNpmPkgParam[] = Object.values(JSON.parse(JSON.stringify(object)))
  return Promise.resolve([...new Set(yarnpkgInfo.map(item => item.resolved))])
}

export async function getFilePathByNpm(file: string): Promise<string[]> {
  const npmpkgInfo: YarnNpmPkgParam[] = (Object.values(JSON.parse(file).dependencies))
  return Promise.resolve([...new Set(npmpkgInfo.map(item => item.resolved))])
}

function parsePackageKey(key: string): { name: string, version: string } | null {
  const atIndex = key.lastIndexOf('@')
  if (atIndex <= 0)
    return null

  return {
    name: key.substring(0, atIndex),
    version: key.substring(atIndex + 1),
  }
}

function buildTarballUrl(name: string, version: string, registry: string): string {
  const normalizedRegistry = registry.endsWith('/') ? registry : `${registry}/`

  if (name.startsWith('@')) {
    const encodedName = name.replace('/', '%2F')
    const shortName = name.split('/')[1]
    return `${normalizedRegistry}${encodedName}/-/${shortName}-${version}.tgz`
  }

  return `${normalizedRegistry}${name}/-/${name}-${version}.tgz`
}

export async function getFilePathByPnpm(file: string): Promise<string[]> {
  const parsed = parse(file)
  const packages = parsed.packages || {}
  const tgzUrls: string[] = []
  const registry = defaultConfig.registry

  for (const [key, value] of Object.entries(packages)) {
    const pkgInfo = value as PnpmPkgParam
    const parsedKey = parsePackageKey(key)

    if (!parsedKey)
      continue

    if (pkgInfo.resolution?.tarball) {
      tgzUrls.push(pkgInfo.resolution.tarball)
    }
    else {
      const url = buildTarballUrl(parsedKey.name, parsedKey.version, registry)
      tgzUrls.push(url)
    }
  }

  return Promise.resolve([...new Set(tgzUrls)].filter(Boolean))
}
