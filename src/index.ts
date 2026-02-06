import type { Arguments } from './types'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { pipeline } from 'node:stream'
import axios from 'axios'
import chalk from 'chalk'
import { Presets, SingleBar } from 'cli-progress'
import { consola } from 'consola'
import minimist from 'minimist'
import { mkdirp } from 'mkdirp'
import pLimit from 'p-limit'
import { LockfileEnum } from './types'
import { defaultConfig, fileTypeList } from './utils/constant'
import { getFilePathByNpm, getFilePathByPnpm, getFilePathByYarn } from './utils/utils'

interface DownloadResult {
  url: string
  success: boolean
  error?: string
  retries: number
}

const CONCURRENT_DOWNLOADS = 5
const MAX_RETRIES = 3
const RETRY_DELAY = 1000

async function downloadWithRetry(
  url: string,
  directory: string,
  progressBar: SingleBar,
  retries = 0,
): Promise<DownloadResult> {
  try {
    const response = await axios.get(url, {
      responseType: 'stream',
      timeout: 30000,
    })

    const output = fs.createWriteStream(directory)

    await new Promise((resolve, reject) => {
      pipeline(response.data, output, (err) => {
        if (err)
          reject(err)
        else
          resolve(true)
      })
    })

    progressBar.increment()
    return { url, success: true, retries }
  }
  catch (error) {
    if (retries < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retries + 1)))
      return downloadWithRetry(url, directory, progressBar, retries + 1)
    }

    progressBar.increment()
    return {
      url,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      retries,
    }
  }
}

function getFileNameFromUrl(url: string): string {
  try {
    return path.posix.basename(new URL(url).pathname)
  }
  catch {
    return url
  }
}

(async () => {
  const args: Arguments = minimist(process.argv.slice(2))
  if (!args.lockfilePath)
    throw consola.error(new Error(chalk.red('请提供 `lockfilePath` 参数。')))

  const lockfileName = path.posix.basename(args.lockfilePath)

  if (!fileTypeList.includes(lockfileName))
    throw new Error(chalk.red('请提供正确的文件类型。'))

  let tgzUrlList: string[] = []
  const file = fs.readFileSync(args.lockfilePath, 'utf8')

  consola.info(`正在解析 ${lockfileName}...`)

  if (lockfileName === LockfileEnum.NPM)
    tgzUrlList = await getFilePathByNpm(file)

  if (lockfileName === LockfileEnum.PNPM)
    tgzUrlList = await getFilePathByPnpm(file)

  if (lockfileName === LockfileEnum.YARN)
    tgzUrlList = await getFilePathByYarn(file)

  consola.success(`解析完成，共找到 ${chalk.cyan(tgzUrlList.length)} 个包`)

  const dir = args.outputDir ?? defaultConfig.directory
  await mkdirp(dir)
  await mkdirp(`${dir}/types`)

  const progressBar = new SingleBar({
    format: `${chalk.cyan('{bar}')} {percentage}% | {value}/{total} | {filename}`,
    barCompleteChar: '█',
    barIncompleteChar: '░',
    hideCursor: true,
    clearOnComplete: false,
    stopOnComplete: true,
  }, Presets.shades_classic)

  progressBar.start(tgzUrlList.length, 0, {
    filename: '准备下载...',
  })

  const limit = pLimit(CONCURRENT_DOWNLOADS)

  const downloadPromises = tgzUrlList.map((url) => {
    return limit(async () => {
      const isTypesPackage = url.includes('/@types/')
      const fileName = getFileNameFromUrl(url)
      const directory = path.join(
        dir,
        isTypesPackage ? 'types' : '',
        fileName,
      )

      progressBar.update({
        filename: fileName.length > 40 ? `...${fileName.slice(-37)}` : fileName,
      })

      return downloadWithRetry(url, directory, progressBar)
    })
  })

  const results = await Promise.all(downloadPromises)
  progressBar.stop()

  const successCount = results.filter(r => r.success).length
  const failedCount = results.length - successCount
  const failedItems = results.filter(r => !r.success)

  consola.log('')
  consola.success(chalk.green(`下载完成！成功: ${successCount}/${results.length}`))

  if (failedCount > 0) {
    consola.error(chalk.red(`失败: ${failedCount}/${results.length}`))
    consola.log('')
    consola.info(chalk.yellow('失败的下载列表：'))
    consola.log(chalk.gray('─'.repeat(80)))

    failedItems.forEach((item, index) => {
      consola.log(`${chalk.red(`${index + 1}.`)} ${chalk.white(getFileNameFromUrl(item.url))}`)
      consola.log(`   ${chalk.gray('URL:')} ${chalk.blue(item.url)}`)
      consola.log(`   ${chalk.gray('错误:')} ${chalk.red(item.error || 'Unknown error')}`)
      consola.log(`   ${chalk.gray('重试次数:')} ${chalk.yellow(item.retries)}`)
      if (index < failedItems.length - 1)
        consola.log('')
    })

    consola.log(chalk.gray('─'.repeat(80)))
  }

  process.exit(failedCount > 0 ? 1 : 0)
})()
