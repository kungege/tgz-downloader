import type { ParsedArgs } from 'minimist'

interface YarnPkgParam {
  version: string
  resolved: string
  integrity: string
}

interface Arguments extends ParsedArgs {
  lockfilePath?: string
  outputDir?: string
}

export { YarnPkgParam, Arguments }
