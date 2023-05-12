import type { ParsedArgs } from 'minimist'

interface YarnNpmPkgParam {
  version: string
  resolved: string
  integrity: string
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
export { YarnNpmPkgParam, Arguments, LockfileEnum }
