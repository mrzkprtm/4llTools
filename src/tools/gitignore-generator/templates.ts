export type TemplateGroup = 'Language' | 'Framework' | 'Tool' | 'Editor' | 'OS'

export interface Template {
  id: string
  name: string
  group: TemplateGroup
  /** Extra search words. */
  tags?: string[]
  body: string
}

const t = (id: string, name: string, group: TemplateGroup, body: string, tags: string[] = []): Template => ({ id, name, group, body: body.trim(), tags })

export const TEMPLATES: Template[] = [
  t('node', 'Node', 'Language', `
# Dependencies
node_modules/
jspm_packages/
.pnp
.pnp.js
.yarn/*
!.yarn/patches
!.yarn/plugins
!.yarn/releases
!.yarn/sdks
!.yarn/versions

# Logs
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*
lerna-debug.log*

# Build and cache
dist/
build/
coverage/
.nyc_output/
.cache/
.parcel-cache/
.eslintcache
.stylelintcache
*.tsbuildinfo
.npm/
.turbo/`, ['javascript', 'typescript', 'npm', 'yarn', 'pnpm', 'bun']),
  t('python', 'Python', 'Language', `
# Byte-compiled files
__pycache__/
*.py[cod]
*$py.class

# Packaging
build/
dist/
*.egg-info/
.eggs/
wheels/
pip-wheel-metadata/

# Virtual environments
.venv/
venv/
env/
ENV/
.python-version

# Tests and tooling
.pytest_cache/
.tox/
.nox/
.coverage
.coverage.*
htmlcov/
.mypy_cache/
.ruff_cache/
.pyre/
.ipynb_checkpoints/`, ['pip', 'poetry', 'jupyter', 'uv']),
  t('go', 'Go', 'Language', `
# Binaries
*.exe
*.exe~
*.dll
*.so
*.dylib
bin/

# Test output
*.test
*.out
coverage.*

# Workspace
go.work
go.work.sum
vendor/`, ['golang']),
  t('rust', 'Rust', 'Language', `
# Build output
target/
debug/

# Backup files from rustfmt
**/*.rs.bk

# Debug info
*.pdb`, ['cargo']),
  t('java', 'Java', 'Language', `
# Compiled files
*.class
*.jar
*.war
*.ear
*.nar
hs_err_pid*
replay_pid*

# Maven
target/
.mvn/wrapper/maven-wrapper.jar

# Gradle
.gradle/
build/
!gradle/wrapper/gradle-wrapper.jar`, ['maven', 'gradle', 'spring']),
  t('android', 'Kotlin / Android', 'Language', `
# Gradle and build
.gradle/
build/
local.properties
captures/
.externalNativeBuild/
.cxx/

# Android Studio
*.iml
.idea/
.navigation/

# Keys and generated files
*.jks
*.keystore
*.apk
*.aab
google-services.json`, ['kotlin', 'gradle', 'android studio']),
  t('swift', 'Swift / iOS', 'Language', `
# Xcode
build/
DerivedData/
*.xcuserstate
xcuserdata/
*.xccheckout
*.moved-aside
*.hmap
*.ipa
*.dSYM.zip
*.dSYM

# Swift Package Manager
.build/
.swiftpm/

# CocoaPods and Carthage
Pods/
Carthage/Build/

# fastlane
fastlane/report.xml
fastlane/screenshots/**/*.png
fastlane/test_output`, ['xcode', 'ios', 'cocoapods', 'macos app']),
  t('flutter', 'Flutter / Dart', 'Language', `
# Dart and Flutter
.dart_tool/
.packages
.pub-cache/
.pub/
build/
.flutter-plugins
.flutter-plugins-dependencies
*.g.dart.bak

# Platform folders
ios/Pods/
ios/.symlinks/
ios/Flutter/Generated.xcconfig
android/.gradle/
android/local.properties
**/doc/api/`, ['dart', 'pub']),
  t('php', 'PHP / Laravel', 'Framework', `
# Composer
/vendor/
composer.phar

# Laravel
/node_modules/
/public/build/
/public/hot
/public/storage
/storage/*.key
/storage/pail
.env
.env.backup
.env.production
.phpunit.result.cache
.phpunit.cache/
Homestead.json
Homestead.yaml
auth.json`, ['laravel', 'composer', 'symfony']),
  t('ruby', 'Ruby / Rails', 'Framework', `
# Bundler
/.bundle/
/vendor/bundle/
*.gem

# Rails
/log/*
/tmp/*
!/log/.keep
!/tmp/.keep
/storage/*
!/storage/.keep
/public/assets/
/public/packs/
/config/master.key
/config/credentials/*.key
/coverage/
.byebug_history`, ['rails', 'gem', 'bundler']),
  t('dotnet', '.NET / C#', 'Language', `
# Build output
[Bb]in/
[Oo]bj/
[Dd]ebug/
[Rr]elease/
x64/
x86/
[Ll]og/
artifacts/

# Visual Studio
.vs/
*.user
*.suo
*.userosscache
*.sln.docstates

# NuGet
*.nupkg
*.snupkg
**/packages/*
!**/packages/build/

# Tests
TestResults/
*.trx
*.coverage`, ['csharp', 'c#', 'visual studio', 'nuget', 'asp.net']),
  t('cpp', 'C / C++', 'Language', `
# Objects and libraries
*.o
*.obj
*.a
*.lib
*.so
*.so.*
*.dylib
*.dll

# Executables
*.exe
*.out
*.app

# Build systems
build/
cmake-build-*/
CMakeFiles/
CMakeCache.txt
cmake_install.cmake
compile_commands.json
.cache/
*.d
*.gch
*.pch`, ['c', 'c++', 'cmake', 'make']),
  t('unity', 'Unity', 'Tool', `
/[Ll]ibrary/
/[Tt]emp/
/[Oo]bj/
/[Bb]uild/
/[Bb]uilds/
/[Ll]ogs/
/[Uu]ser[Ss]ettings/
/[Mm]emoryCaptures/
/[Rr]ecordings/

# Generated project files
*.csproj
*.unityproj
*.sln
*.pidb
*.booproj
*.svd
*.pdb
*.mdb
*.opendb
*.VC.db

# Builds and crash reports
*.apk
*.aab
*.unitypackage
crashlytics-build.properties
sysinfo.txt`, ['game', 'gamedev', 'c#']),
  t('terraform', 'Terraform', 'Tool', `
# Local state and plugins
**/.terraform/*
*.tfstate
*.tfstate.*
crash.log
crash.*.log

# Variable files often hold secrets
*.tfvars
*.tfvars.json

# Overrides and plans
override.tf
override.tf.json
*_override.tf
*_override.tf.json
*.tfplan
.terraformrc
terraform.rc`, ['iac', 'hcl', 'opentofu']),
  t('docker', 'Docker', 'Tool', `
# Local Docker overrides and data
docker-compose.override.yml
compose.override.yaml
.docker/
*.tar
data/`, ['compose', 'container']),
  t('nextjs', 'Next.js', 'Framework', `
/.next/
/out/
/build/
next-env.d.ts
*.tsbuildinfo
.vercel
.env*.local`, ['react', 'vercel']),
  t('vite', 'Vite', 'Framework', `
dist/
dist-ssr/
*.local
.vite/
vite.config.*.timestamp-*`, ['react', 'vue', 'svelte']),
  t('nuxt', 'Nuxt / Vue', 'Framework', `
.nuxt/
.output/
.data/
.nitro/
.cache/
dist/`, ['vue']),
  t('angular', 'Angular', 'Framework', `
/dist/
/tmp/
/out-tsc/
/bazel-out/
.angular/cache/
.sass-cache/
/connect.lock
/libpeerconnection.log
testem.log
/typings`, []),
  t('django', 'Django', 'Framework', `
*.log
local_settings.py
db.sqlite3
db.sqlite3-journal
media/
staticfiles/
/static_root/
celerybeat-schedule
celerybeat.pid`, ['python']),
  t('env', 'Env files', 'Tool', `
.env
.env.*
!.env.example
!.env.sample
.envrc
*.pem
*.key
secrets.*`, ['dotenv', 'secrets', 'credentials']),
  t('logs', 'Logs', 'Tool', `
logs/
*.log
*.log.*
*.pid
*.seed
*.pid.lock`, ['log']),
  t('archives', 'Archives', 'Tool', `
*.7z
*.dmg
*.gz
*.iso
*.rar
*.tar
*.tgz
*.zip`, ['zip']),
  t('macos', 'macOS', 'OS', `
.DS_Store
.AppleDouble
.LSOverride
._*
.DocumentRevisions-V100
.fseventsd
.Spotlight-V100
.TemporaryItems
.Trashes
.VolumeIcon.icns
.com.apple.timemachine.donotpresent`, ['mac', 'apple', 'ds_store']),
  t('windows', 'Windows', 'OS', `
Thumbs.db
Thumbs.db:encryptable
ehthumbs.db
ehthumbs_vista.db
[Dd]esktop.ini
$RECYCLE.BIN/
*.lnk
*.stackdump`, ['win']),
  t('linux', 'Linux', 'OS', `
*~
.fuse_hidden*
.directory
.Trash-*
.nfs*`, ['ubuntu']),
  t('vscode', 'VS Code', 'Editor', `
.vscode/*
!.vscode/settings.json
!.vscode/tasks.json
!.vscode/launch.json
!.vscode/extensions.json
!.vscode/*.code-snippets
.history/
*.vsix`, ['visual studio code', 'cursor']),
  t('jetbrains', 'JetBrains IDEs', 'Editor', `
.idea/
*.iml
*.ipr
*.iws
out/
.fleet/`, ['intellij', 'webstorm', 'pycharm', 'phpstorm', 'goland', 'rider']),
  t('vim', 'Vim', 'Editor', `
[._]*.s[a-v][a-z]
!*.svg
[._]*.sw[a-p]
[._]s[a-rt-v][a-z]
[._]ss[a-gi-z]
[._]sw[a-p]
Session.vim
Sessionx.vim
.netrwhist
tags
[._]*.un~`, ['neovim', 'nvim']),
  t('emacs', 'Emacs', 'Editor', `
*~
\\#*\\#
/.emacs.desktop
/.emacs.desktop.lock
*.elc
auto-save-list
tramp
.\\#*`, []),
  t('sublime', 'Sublime Text', 'Editor', `
*.tmlanguage.cache
*.tmPreferences.cache
*.stTheme.cache
*.sublime-workspace
sftp-config.json`, []),
]

export const TEMPLATE_BY_ID = new Map(TEMPLATES.map((x) => [x.id, x]))

export function searchTemplates(query: string): Template[] {
  const q = query.trim().toLowerCase()
  if (!q) return TEMPLATES
  return TEMPLATES.filter((x) => x.name.toLowerCase().includes(q) || x.id.includes(q) || x.tags?.some((tag) => tag.includes(q)))
}

/**
 * Merges the chosen templates into one .gitignore. Each template gets a
 * section header; a pattern already written by an earlier section is dropped,
 * and comment lines or blank runs left behind are tidied up.
 */
export function buildGitignore(ids: string[], custom = ''): { text: string; lines: number; removed: number } {
  const seen = new Set<string>()
  const sections: string[] = []
  let removed = 0
  const addSection = (title: string, body: string) => {
    const out: string[] = []
    for (const raw of body.split('\n')) {
      const line = raw.replace(/\s+$/, '')
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        out.push(trimmed)
        continue
      }
      if (seen.has(trimmed)) {
        removed++
        continue
      }
      seen.add(trimmed)
      out.push(line)
    }
    // Drop comments that no longer head any pattern, then collapse blank runs.
    const cleaned: string[] = []
    for (let i = 0; i < out.length; i++) {
      const l = out[i]
      if (l.startsWith('#')) {
        let j = i + 1
        while (j < out.length && out[j].startsWith('#')) j++
        if (j >= out.length || out[j] === '') continue
      }
      if (l === '' && (cleaned.length === 0 || cleaned[cleaned.length - 1] === '')) continue
      cleaned.push(l)
    }
    while (cleaned.length && cleaned[cleaned.length - 1] === '') cleaned.pop()
    if (cleaned.length) sections.push(`### ${title} ###\n${cleaned.join('\n')}`)
  }
  for (const id of ids) {
    const tpl = TEMPLATE_BY_ID.get(id)
    if (tpl) addSection(tpl.name, tpl.body)
  }
  if (custom.trim()) addSection('Custom', custom)
  const text = sections.length ? `${sections.join('\n\n')}\n` : ''
  const lines = text ? text.split('\n').filter((l) => l.trim() && !l.startsWith('#')).length : 0
  return { text, lines, removed }
}
