import type { ParsedArgs } from 'minimist'

interface YarnNpmPkgParam {
  version: string
  resolved: string
  integrity: string
}
interface PnpmPkgParam {
  resolution: {
    integrity: string
    registry?: string
    tarball?: string
  }
  id: string
  name: string
  version: string
}

interface Arguments extends ParsedArgs {
  lockfilePath?: string
  outputDir?: string
}
enum LockfileEnum {
  YARN = 'yarn.lock',
  PNPM = 'pnpm-lock.yaml',
  NPM = 'package-lock.json',
}
export { Arguments, LockfileEnum, PnpmPkgParam, YarnNpmPkgParam }
