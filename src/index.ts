import fs from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream'
import lockfile from '@yarnpkg/lockfile'
import { mkdirp } from 'mkdirp'
import axios from 'axios'
import minimist from 'minimist'
import chalk from 'chalk'
import type { Arguments, YarnPkgParam } from './types'

const defaultConfig = {
  registry: 'https://registry.npm.taobao.org/',
  directory: './tgz-packages',
};

(async () => {
  const args: Arguments = minimist(process.argv.slice(2))
  if (!args.lockfilePath)
    throw new Error(chalk.red('Please provide the `lockfilePath` parameter.'))

  const file = fs.readFileSync(args.lockfilePath, 'utf8')
  const { object } = lockfile.parse(file)
  const yarnpkgInfo: YarnPkgParam[] = Object.values(JSON.parse(JSON.stringify(object)))
  const tgzUrlArr: string[] = [...new Set(yarnpkgInfo.map(item => item.resolved))]

  await mkdirp(args.outputDir ?? defaultConfig.directory)

  for (const [index, item] of tgzUrlArr.entries()) {
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
    process.stdout.write(chalk.blue(`schedule：${index + 1} / ${tgzUrlArr.length} \r`))
  }
  // eslint-disable-next-line no-console
  console.log(chalk.green('\ndone'))
})()
