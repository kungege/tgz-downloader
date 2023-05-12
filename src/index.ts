import fs from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream'
import lockfile from '@yarnpkg/lockfile'
import { mkdirp } from 'mkdirp'
import axios from 'axios'
import minimist from 'minimist'
import chalk from 'chalk'
import type { Arguments, YarnNpmPkgParam } from './types'
import { LockfileEnum } from './types'
import { defaultConfig, fileTypeList } from './utils/constant'

(async () => {
  const args: Arguments = minimist(process.argv.slice(2))
  if (!args.lockfilePath)
    throw new Error(chalk.red('Please provide the `lockfilePath` parameter.'))

  const lockfileName = path.posix.basename(args.lockfilePath)

  if (!fileTypeList.includes(lockfileName))
    throw new Error(chalk.red('Please provide the correct file type.'))

  let tgzUrlList: string[] = []
  const file = fs.readFileSync(args.lockfilePath, 'utf8')

  if (lockfileName === LockfileEnum.NPM)
    tgzUrlList = await getFilePathByNpm(file)
  // TODO pnpm
  // if (lockfileName  === LockfileEnum.PNPM)
  if (lockfileName === LockfileEnum.YARN)
    tgzUrlList = await getFilePathByYarn(file)

  await mkdirp(args.outputDir ?? defaultConfig.directory)

  for (const [index, item] of tgzUrlList.entries()) {
    const directory = path.join(args.outputDir ?? defaultConfig.directory, path.posix.basename(new URL(item).pathname))
    const response = await axios.get(item, { responseType: 'stream' })
    const output = fs.createWriteStream(directory)
    await new Promise((_resolve, reject) => {
      pipeline(response.data, output, (err) => {
        if (!err)
          _resolve(true)
        else
          reject(err)
      })
    })
    process.stdout.write(chalk.blue(`schedule：${index + 1} / ${tgzUrlList.length} \r`))
  }
  // eslint-disable-next-line no-console
  console.log(chalk.green('\ndone'))
})()
async function getFilePathByYarn(file: string): Promise<string[]> {
  const { object } = lockfile.parse(file)
  const yarnpkgInfo: YarnNpmPkgParam[] = Object.values(JSON.parse(JSON.stringify(object)))
  return Promise.resolve([...new Set(yarnpkgInfo.map(item => item.resolved))])
}
async function getFilePathByNpm(file: string): Promise<string[]> {
  const npmpkgInfo: YarnNpmPkgParam[] = (Object.values(JSON.parse(file).dependencies))
  return Promise.resolve([...new Set(npmpkgInfo.map(item => item.resolved))])
}
