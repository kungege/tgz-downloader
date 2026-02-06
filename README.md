# tgz-downloader

![Node CI](https://github.com/kungege/tgz-downloader/actions/workflows/test.yml/badge.svg)

Download npm packages as tarballs (.tgz) from lockfiles for offline use or Nexus upload.

## Features

- Support for multiple lockfile formats:
  - `yarn.lock` (V1)
  - `package-lock.json` (npm)
  - `pnpm-lock.yaml` (V6 and **V9**)
- Downloads all dependencies (including transitive ones) as `.tgz` files
- Useful for:
  - Offline installation
  - Uploading to internal Nexus/Artifactory
  - Backup package dependencies

## Install

### Global Installation

```bash
npm install tgz-downloader -g
```

### Local Development

```bash
git clone https://github.com/kungege/tgz-downloader.git
cd tgz-downloader
pnpm install
pnpm build
```

## Usage

### Command Line

```bash
tgz-download --lockfilePath=/path/to/your/pnpm-lock.yaml --outputDir=/path/to/output
```

### Options

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--lockfilePath` | Yes | - | Path to lockfile (yarn.lock, package-lock.json, or pnpm-lock.yaml) |
| `--outputDir` | No | `./tgz-packages` | Directory to save downloaded tgz files |

### Examples

```bash
# Download from pnpm-lock.yaml
tgz-download --lockfilePath=./pnpm-lock.yaml --outputDir=./tgz-packages

# Download from package-lock.json
tgz-download --lockfilePath=./package-lock.json

# Download from yarn.lock
tgz-download --lockfilePath=./yarn.lock --outputDir=./packages
```

## Lockfile Support Status

| Lockfile | Format Version | Status |
|----------|---------------|--------|
| yarn.lock | V1 | ✅ Supported |
| package-lock.json | V1-V3 | ✅ Supported |
| pnpm-lock.yaml | V6 | ✅ Supported |
| pnpm-lock.yaml | V9 (lockfileVersion: '9.0') | ✅ **Supported** |

### Note on pnpm v9 Support

Starting from v9, pnpm changed the lockfile format. The `packages` section keys are now in the format `name@version` (e.g., `@algolia/abtesting@1.14.0`), and the `resolution` field no longer contains `tarball` URLs. This tool will automatically construct the correct download URLs from the registry.

## Registry

By default, the tool downloads packages from:
- **Default**: `https://registry.npmjs.org/`
- **China Mirror** (if needed): `https://registry.npmmirror.com/`

## Output Structure

The downloaded `.tgz` files will be organized in the output directory:

```
tgz-packages/
├── package-name-1.0.0.tgz
├── @scope/
│   └── package-name-2.0.0.tgz
└── types/
    └── @types/
        └── node-20.0.0.tgz
```

## Use Cases

### Uploading to Nexus

After downloading all tgz files, you can upload them to your internal Nexus:

```bash
# Navigate to the output directory
cd tgz-packages

# Upload to Nexus (example using curl)
for tgz in *.tgz; do
  curl -v --user 'username:password' \
    --upload-file "$tgz" \
    "https://nexus.company.com/repository/npm-hosted/${tgz}"
done
```

### Installing from Local tgz Files

```bash
# Install a single package
npm install ./tgz-packages/package-name-1.0.0.tgz

# Install all packages
npm install ./tgz-packages/*.tgz
```

## License

`tgz-downloader` is licensed under the [MIT license](https://opensource.org/licenses/MIT).
