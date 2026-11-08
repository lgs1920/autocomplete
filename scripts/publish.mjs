if (process.env.AUTOCOMPLETE_BUN_PUBLISH_LIFECYCLE === '1') process.exit(0)

const argumentsList = Bun.argv.slice(2)
const incrementFlags = argumentsList.filter(argument => argument.startsWith('--') && argument !== '--preview')
const preview = argumentsList.includes('--preview')
const increments = ['--patch', '--minor', '--major']

if (argumentsList.some(argument => argument !== '--preview' && !increments.includes(argument)) || incrementFlags.length > 1) {
  console.error('Usage: bun run publish [--patch|--minor|--major] [--preview]')
  process.exit(1)
}

/**
 * Run a command and return its trimmed standard output.
 * @param {string} command Command to run.
 * @param {string[]} commandArguments Arguments passed to the command.
 * @returns {string} The command standard output.
 */
const output = (command, commandArguments) => {
  const result = Bun.spawnSync([command, ...commandArguments], {
    stdout: 'pipe',
    stderr: 'pipe'
  })

  if (result.exitCode !== 0) {
    const error = new TextDecoder().decode(result.stderr).trim()
    console.error(error || `Command failed: ${command} ${commandArguments.join(' ')}`)
    process.exit(result.exitCode || 1)
  }

  return new TextDecoder().decode(result.stdout).trim()
}

/**
 * Run a command while forwarding its output to the terminal.
 * @param {string} command Command to run.
 * @param {string[]} commandArguments Arguments passed to the command.
 * @returns {Promise<void>} Resolves after the command succeeds.
 */
const run = async (command, commandArguments) => {
  const child = Bun.spawn([command, ...commandArguments], {
    stdout: 'inherit',
    stderr: 'inherit'
  })
  const exitCode = await child.exited

  if (exitCode !== 0) process.exit(exitCode)
}

/**
 * Parse a stable semantic version.
 * @param {string} version Version string to parse.
 * @returns {number[] | null} The numeric version parts, or null when invalid.
 */
const parseVersion = version => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  return match ? match.slice(1).map(Number) : null
}

/**
 * Compare two stable semantic versions.
 * @param {number[]} left First version parts.
 * @param {number[]} right Second version parts.
 * @returns {number} A negative, zero, or positive comparison result.
 */
const compareVersions = (left, right) => {
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index]
  }

  return 0
}

/**
 * Increment a stable semantic version.
 * @param {number[]} version Version parts to increment.
 * @param {string} increment Increment type.
 * @returns {number[]} The incremented version parts.
 */
const incrementVersion = (version, increment) => {
  const [major, minor, patch] = version

  if (increment === '--major') return [major + 1, 0, 0]
  if (increment === '--minor') return [major, minor + 1, 0]
  return [major, minor, patch + 1]
}

const packageJson = await Bun.file('./package.json').json()
const currentVersion = parseVersion(packageJson.version)

if (!currentVersion) {
  console.error(`Invalid package version: ${packageJson.version}`)
  process.exit(1)
}

if (output('git', ['status', '--porcelain'])) {
  console.error('Publication stopped: the working tree contains uncommitted changes.')
  process.exit(1)
}

const branch = output('git', ['branch', '--show-current'])
if (branch !== 'main') {
  console.error(`Publication stopped: run this command from main (current branch: ${branch || 'detached HEAD'}).`)
  process.exit(1)
}

const latestTag = output('git', ['tag', '--list', 'v*', '--sort=-version:refname']).split('\n')[0]
const latestTagVersion = latestTag ? parseVersion(latestTag.slice(1)) : null

if (latestTag && !latestTagVersion) {
  console.error(`Publication stopped: invalid version tag ${latestTag}.`)
  process.exit(1)
}

if (latestTagVersion && compareVersions(currentVersion, latestTagVersion) < 0) {
  console.error(`Publication stopped: package.json version ${packageJson.version} is behind ${latestTag}.`)
  process.exit(1)
}

const selectedIncrement = incrementFlags[0]
const shouldUseCurrentVersion = !selectedIncrement && (!latestTagVersion || compareVersions(currentVersion, latestTagVersion) > 0)
const releaseParts = shouldUseCurrentVersion ? currentVersion : incrementVersion(currentVersion, selectedIncrement || '--patch')
const releaseVersion = releaseParts.join('.')
const releaseTag = `v${releaseVersion}`
const existingTag = output('git', ['tag', '--list', releaseTag])

if (existingTag) {
  console.error(`Publication stopped: tag ${releaseTag} already exists.`)
  process.exit(1)
}

const readme = await Bun.file('./README.md').text()
const releaseLine = /^The current release is `[^`]+`\.$/m

if (!releaseLine.test(readme)) {
  console.error('Publication stopped: could not find the current release line in README.md.')
  process.exit(1)
}

const compareUrl = latestTag
  ? `https://github.com/lgs1920/autocomplete/compare/${latestTag}...${releaseTag}`
  : `https://github.com/lgs1920/autocomplete/releases/tag/${releaseTag}`
const tagMessage = `Release ${releaseTag}\n\nPublish @lgs1920/autocomplete ${releaseVersion} to npm.\n\nChanges: ${compareUrl}`
const versionCommitRequired = releaseVersion !== packageJson.version

if (preview) {
  console.log(`Proposed release: ${releaseTag}`)
  console.log(versionCommitRequired ? 'The release will update package.json and README.md.' : 'The current package version will be tagged as-is.')
  console.log('')
  console.log(tagMessage)
  process.exit(0)
}

if (versionCommitRequired) {
  const updatedReadme = readme.replace(releaseLine, `The current release is \`${releaseVersion}\`.`)
  await Bun.write('./package.json', `${JSON.stringify({...packageJson, version: releaseVersion}, null, 2)}\n`)
  await Bun.write('./README.md', updatedReadme)
  await run('git', ['add', 'package.json', 'README.md'])
  await run('git', ['commit', '-m', releaseTag])
}

await run('git', ['tag', '-a', releaseTag, '-m', tagMessage])
await run('git', ['push', 'origin', 'main', '--follow-tags'])
console.log(`GitHub release workflow started for ${releaseTag}.`)
