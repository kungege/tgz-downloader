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
  skipped?: boolean
  error?: string
  retries: number
}

interface DownloadOptions {
  force: boolean
  maxRetries: number
  timeout: number
}

const DEFAULT_CONCURRENCY = 5
const DEFAULT_MAX_RETRIES = 3
const DEFAULT_TIMEOUT = 30000
const RETRY_DELAY = 1000

function showHelp() {
  process.stdout.write(`tgz-download

Download npm package tarballs from a lockfile.

Usage:
  tgz-download --lockfilePath=./pnpm-lock.yaml [options]

Options:
  --lockfilePath <path>  yarn.lock, package-lock.json or pnpm-lock.yaml (required)
  --outputDir <path>     Output directory (default: ./tgz-packages)
  --registry <url>       Registry used to construct pnpm tarball URLs
  --concurrency <number> Concurrent downloads (default: 5)
  --retries <number>     Retries after the first attempt (default: 3)
  --timeout <ms>         Request timeout in milliseconds (default: 30000)
  --force                Overwrite existing tarballs
  -h, --help             Show this help message\n`)
}

function parseIntegerOption(
  value: string | number | undefined,
  fallback: number,
  name: string,
  minimum: number,
) {
  if (value === undefined)
    return fallback

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < minimum)
    throw new Error(`\`--${name}\` 必须是大于等于 ${minimum} 的整数。`)

  return parsed
}

function getFileNameFromUrl(url: string): string {
  const fileName = path.posix.basename(new URL(url).pathname)
  if (!fileName.endsWith('.tgz'))
    throw new Error(`无法从 URL 识别 tgz 文件名: ${url}`)
  return fileName
}

function getScopeDirectory(url: string) {
  const pathname = decodeURIComponent(new URL(url).pathname)
  const firstSegment = pathname.split('/').filter(Boolean)[0]

  if (!firstSegment?.startsWith('@'))
    return ''

  return firstSegment === '@types' ? 'types' : firstSegment
}

function getDownloadTarget(outputDir: string, url: string) {
  return path.join(outputDir, getScopeDirectory(url), getFileNameFromUrl(url))
}

async function downloadWithRetry(
  url: string,
  destination: string,
  options: DownloadOptions,
): Promise<DownloadResult> {
  await mkdirp(path.dirname(destination))

  if (!options.force && fs.existsSync(destination) && fs.statSync(destination).size > 0)
    return { url, success: true, skipped: true, retries: 0 }

  const temporaryFile = `${destination}.${process.pid}.part`
  let lastError: unknown

  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    try {
      await fs.promises.rm(temporaryFile, { force: true })

      const response = await axios.get(url, {
        responseType: 'stream',
        timeout: options.timeout,
      })

      await new Promise<void>((resolve, reject) => {
        pipeline(response.data, fs.createWriteStream(temporaryFile), (error) => {
          if (error)
            reject(error)
          else
            resolve()
        })
      })

      if (options.force)
        await fs.promises.rm(destination, { force: true })

      await fs.promises.rename(temporaryFile, destination)
      return { url, success: true, retries: attempt }
    }
    catch (error) {
      lastError = error
      await fs.promises.rm(temporaryFile, { force: true })

      if (attempt < options.maxRetries) {
        const delay = Math.min(RETRY_DELAY * 2 ** attempt, 5000)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  return {
    url,
    success: false,
    error: lastError instanceof Error ? lastError.message : String(lastError),
    retries: options.maxRetries,
  }
}

async function main() {
  const args = minimist(process.argv.slice(2), {
    string: ['lockfilePath', 'outputDir', 'registry', 'concurrency', 'retries', 'timeout'],
    boolean: ['force', 'help'],
    alias: { h: 'help' },
  }) as Arguments

  if (args.help) {
    showHelp()
    return
  }

  if (!args.lockfilePath)
    throw new Error('请提供 `lockfilePath` 参数。使用 `tgz-download --help` 查看帮助。')

  const lockfilePath = path.resolve(args.lockfilePath)
  const lockfileName = path.basename(lockfilePath)

  if (!fileTypeList.includes(lockfileName))
    throw new Error('lockfile 必须是 yarn.lock、package-lock.json 或 pnpm-lock.yaml。')
  if (!fs.existsSync(lockfilePath))
    throw new Error(`lockfile 不存在: ${lockfilePath}`)

  const concurrency = parseIntegerOption(args.concurrency, DEFAULT_CONCURRENCY, 'concurrency', 1)
  const maxRetries = parseIntegerOption(args.retries, DEFAULT_MAX_RETRIES, 'retries', 0)
  const timeout = parseIntegerOption(args.timeout, DEFAULT_TIMEOUT, 'timeout', 1)
  const registry = args.registry ?? defaultConfig.registry

  try {
    const registryUrl = new URL(registry)
    if (!['http:', 'https:'].includes(registryUrl.protocol))
      throw new Error('unsupported protocol')
  }
  catch {
    throw new Error(`registry 不是有效 URL: ${registry}`)
  }

  consola.info(`正在解析 ${lockfileName}...`)
  const file = fs.readFileSync(lockfilePath, 'utf8')
  let tgzUrlList: string[] = []

  if (lockfileName === LockfileEnum.NPM)
    tgzUrlList = await getFilePathByNpm(file)
  if (lockfileName === LockfileEnum.PNPM)
    tgzUrlList = await getFilePathByPnpm(file, registry)
  if (lockfileName === LockfileEnum.YARN)
    tgzUrlList = await getFilePathByYarn(file)

  consola.success(`解析完成，共找到 ${chalk.cyan(tgzUrlList.length)} 个包`)

  const outputDir = path.resolve(args.outputDir ?? defaultConfig.directory)
  try {
    await mkdirp(outputDir)
  }
  catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`无法创建输出目录 ${outputDir}: ${reason}。项目目录请使用 \`./tgz\`。`)
  }

  if (tgzUrlList.length === 0) {
    consola.success('没有需要下载的包。')
    return
  }

  const progressBar = new SingleBar({
    format: `${chalk.cyan('{bar}')} {percentage}% | {value}/{total} | {filename}`,
    barCompleteChar: '█',
    barIncompleteChar: '░',
    hideCursor: true,
    clearOnComplete: false,
    stopOnComplete: true,
  }, Presets.shades_classic)

  progressBar.start(tgzUrlList.length, 0, { filename: '准备下载...' })
  const limit = pLimit(concurrency)

  const results = await Promise.all(tgzUrlList.map(url => limit(async () => {
    const fileName = getFileNameFromUrl(url)
    progressBar.update({
      filename: fileName.length > 40 ? `...${fileName.slice(-37)}` : fileName,
    })

    const result = await downloadWithRetry(url, getDownloadTarget(outputDir, url), {
      force: Boolean(args.force),
      maxRetries,
      timeout,
    })
    progressBar.increment()
    return result
  })))

  progressBar.stop()

  const successCount = results.filter(result => result.success).length
  const skippedCount = results.filter(result => result.skipped).length
  const failedItems = results.filter(result => !result.success)

  consola.log('')
  consola.success(chalk.green(`下载完成！成功: ${successCount}/${results.length}，跳过: ${skippedCount}`))

  if (failedItems.length === 0)
    return

  consola.error(chalk.red(`失败: ${failedItems.length}/${results.length}`))
  consola.info(chalk.yellow('失败的下载列表：'))
  consola.log(chalk.gray('─'.repeat(80)))

  failedItems.forEach((item, index) => {
    consola.log(`${chalk.red(`${index + 1}.`)} ${chalk.white(getFileNameFromUrl(item.url))}`)
    consola.log(`   ${chalk.gray('URL:')} ${chalk.blue(item.url)}`)
    consola.log(`   ${chalk.gray('错误:')} ${chalk.red(item.error || 'Unknown error')}`)
    consola.log(`   ${chalk.gray('重试次数:')} ${chalk.yellow(item.retries)}`)
  })

  consola.log(chalk.gray('─'.repeat(80)))
  process.exitCode = 1
}

main().catch((error) => {
  consola.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
