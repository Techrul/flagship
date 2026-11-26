// Writes the package-manager files for a release, from its version and SHA256SUMS.txt.
//   node scripts/render-packages.mjs <version> <path/to/SHA256SUMS.txt> [outDir=.]
// Produces:
//   bucket/flagship.json                       Scoop   (scoop bucket add flagship https://github.com/Techrul/flagship)
//   Casks/flagship.rb                          Homebrew (brew tap techrul/flagship https://github.com/Techrul/flagship)
//   packaging/winget/<version>/*.yaml          winget  (submitted to microsoft/winget-pkgs by CI)
//   packaging/aur/PKGBUILD                     AUR     (pushed to aur.archlinux.org by CI)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'Techrul/flagship';
const HOMEPAGE = `https://github.com/${REPO}`;
const SHORT = 'A launcher for Scratch games, powered by TurboWarp';
const LONG = 'Flagship is a game launcher for Scratch projects: paste a link, it downloads the game, keeps a local copy and plays it '
  + 'with the TurboWarp player. Setting profiles, per-game settings, themes and a pause button. '
  + 'Vibe-coded: almost all of the code is written by an AI (Claude). Not affiliated with the Scratch Team.';

const fileName = (version, suffix) => `Flagship-${version}-${suffix}`;
const download = (version, file) => `${HOMEPAGE}/releases/download/v${version}/${file}`;

/** "abc123  file.zip" lines -> { "file.zip": "abc123" } */
export function parseSums(text) {
  const sums = {};
  for (const line of text.split('\n')) {
    const m = line.trim().match(/^([0-9a-f]{64})\s+\*?(.+)$/i);
    if (m) sums[m[2].trim()] = m[1].toLowerCase();
  }
  return sums;
}

function need(sums, file) {
  if (!sums[file]) throw new Error(`SHA256SUMS has no entry for ${file}`);
  return sums[file];
}

export function renderScoop(version, sums) {
  const x64 = fileName(version, 'win-x64.zip');
  const arm = fileName(version, 'win-arm64.zip');
  return JSON.stringify({
    version,
    description: `${SHORT}. Vibe-coded (written by AI).`,
    homepage: HOMEPAGE,
    license: 'MIT',
    architecture: {
      '64bit': { url: download(version, x64), hash: need(sums, x64) },
      arm64: { url: download(version, arm), hash: need(sums, arm) },
    },
    shortcuts: [['Flagship.exe', 'Flagship']],
    checkver: { github: HOMEPAGE },
    autoupdate: {
      architecture: {
        '64bit': { url: `${HOMEPAGE}/releases/download/v$version/Flagship-$version-win-x64.zip` },
        arm64: { url: `${HOMEPAGE}/releases/download/v$version/Flagship-$version-win-arm64.zip` },
      },
    },
  }, null, 2) + '\n';
}

export function renderCask(version, sums) {
  const zip = fileName(version, 'mac-universal.zip');
  return `cask "flagship" do
  version "${version}"
  sha256 "${need(sums, zip)}"

  url "${HOMEPAGE}/releases/download/v#{version}/Flagship-#{version}-mac-universal.zip"
  name "Flagship"
  desc "${SHORT} (vibe-coded)"
  homepage "${HOMEPAGE}"

  app "Flagship.app"

  # Flagship isn't signed with a paid Apple certificate, so macOS would block it on first launch.
  # This tap is Techrul's own (not Homebrew's official list), so it can clear the "downloaded" flag
  # after installing. You're trusting this repo when you do that; the full source is right here.
  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-dr", "com.apple.quarantine", "#{appdir}/Flagship.app"],
                   sudo: false
  end

  zap trash: [
    "~/Library/Application Support/Flagship",
    "~/Library/Preferences/com.techrul.flagship.plist",
  ]
end
`;
}

export function renderWinget(version, sums) {
  const id = 'Techrul.Flagship';
  const mv = '1.9.0';
  // Free text is written JSON-quoted, which is valid YAML and safe for colons, quotes and #.
  const header = (type) => `# yaml-language-server: $schema=https://aka.ms/winget-manifest.${type}.${mv}.schema.json\n`;
  const x64 = fileName(version, 'win-x64.exe');
  const arm = fileName(version, 'win-arm64.exe');
  return {
    [`${id}.yaml`]: `${header('version')}
PackageIdentifier: ${id}
PackageVersion: ${version}
DefaultLocale: en-US
ManifestType: version
ManifestVersion: ${mv}
`,
    [`${id}.installer.yaml`]: `${header('installer')}
PackageIdentifier: ${id}
PackageVersion: ${version}
InstallerType: nullsoft
Scope: user
InstallModes:
- interactive
- silent
- silentWithProgress
UpgradeBehavior: install
Installers:
- Architecture: x64
  InstallerUrl: ${download(version, x64)}
  InstallerSha256: ${need(sums, x64).toUpperCase()}
- Architecture: arm64
  InstallerUrl: ${download(version, arm)}
  InstallerSha256: ${need(sums, arm).toUpperCase()}
ManifestType: installer
ManifestVersion: ${mv}
`,
    [`${id}.locale.en-US.yaml`]: `${header('defaultLocale')}
PackageIdentifier: ${id}
PackageVersion: ${version}
PackageLocale: en-US
Publisher: Techrul
PublisherUrl: https://github.com/Techrul
PackageName: Flagship
PackageUrl: ${HOMEPAGE}
License: MIT
LicenseUrl: ${HOMEPAGE}/blob/main/LICENSE
ShortDescription: ${JSON.stringify(SHORT + '.')}
Description: ${JSON.stringify(LONG)}
Tags:
- scratch
- turbowarp
- games
- game-launcher
ReleaseNotesUrl: ${HOMEPAGE}/releases/tag/v${version}
ManifestType: defaultLocale
ManifestVersion: ${mv}
`,
  };
}

export function renderPkgbuild(version, sums, iconSha, licenseSha) {
  if (version.includes('-')) throw new Error('AUR versions cannot contain "-" (betas are not published to the AUR)');
  const x64 = fileName(version, 'linux-x64.tar.gz');
  const arm = fileName(version, 'linux-arm64.tar.gz');
  return `# Maintainer: Techrul <https://github.com/Techrul>
# Generated by scripts/render-packages.mjs in ${HOMEPAGE}. Edit the generator, not this file.
pkgname=flagship-bin
_pkgname=flagship
pkgver=${version}
pkgrel=1
pkgdesc="${SHORT} (vibe-coded)"
arch=('x86_64' 'aarch64')
url="${HOMEPAGE}"
license=('MIT')
depends=('gtk3' 'nss' 'alsa-lib' 'xdg-utils')
provides=('flagship')
conflicts=('flagship')
options=('!strip' '!debug')
source=("flagship.png::https://raw.githubusercontent.com/${REPO}/v\${pkgver}/build-resources/icon.png"
        "LICENSE::https://raw.githubusercontent.com/${REPO}/v\${pkgver}/LICENSE")
source_x86_64=("${HOMEPAGE}/releases/download/v\${pkgver}/Flagship-\${pkgver}-linux-x64.tar.gz")
source_aarch64=("${HOMEPAGE}/releases/download/v\${pkgver}/Flagship-\${pkgver}-linux-arm64.tar.gz")
sha256sums=('${iconSha}'
            '${licenseSha}')
sha256sums_x86_64=('${need(sums, x64)}')
sha256sums_aarch64=('${need(sums, arm)}')

package() {
  local _dir="Flagship-\${pkgver}-linux-x64"
  [[ $CARCH == aarch64 ]] && _dir="Flagship-\${pkgver}-linux-arm64"

  install -d "$pkgdir/opt/$_pkgname"
  cp -a "$srcdir/$_dir/." "$pkgdir/opt/$_pkgname/"
  chmod 4755 "$pkgdir/opt/$_pkgname/chrome-sandbox"

  install -d "$pkgdir/usr/bin"
  ln -s "/opt/$_pkgname/flagship" "$pkgdir/usr/bin/flagship"

  install -Dm644 "$srcdir/flagship.png" "$pkgdir/usr/share/icons/hicolor/1024x1024/apps/flagship.png"
  install -Dm644 "$srcdir/LICENSE" "$pkgdir/usr/share/licenses/$pkgname/LICENSE"
  install -Dm644 /dev/stdin "$pkgdir/usr/share/applications/flagship.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Flagship
GenericName=Game Launcher
Comment=${SHORT}
Exec=flagship %U
Icon=flagship
Terminal=false
Categories=Game;
Keywords=scratch;turbowarp;games;launcher;
StartupWMClass=flagship
EOF
}
`;
}

/** Everything for one release, as { relativePath: content }. */
export function renderAll(version, sums, repoFiles) {
  const out = {
    'bucket/flagship.json': renderScoop(version, sums),
    'Casks/flagship.rb': renderCask(version, sums),
  };
  for (const [name, text] of Object.entries(renderWinget(version, sums))) {
    out[`packaging/winget/${version}/${name}`] = text;
  }
  if (!version.includes('-')) {
    const sha = (buf) => createHash('sha256').update(buf).digest('hex');
    out['packaging/aur/PKGBUILD'] = renderPkgbuild(version, sums, sha(repoFiles.icon), sha(repoFiles.license));
  }
  return out;
}

// CLI
if (process.argv[1] && import.meta.url && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [version, sumsPath, outDir = '.'] = process.argv.slice(2);
  if (!version || !sumsPath) {
    console.error('usage: node scripts/render-packages.mjs <version> <SHA256SUMS.txt> [outDir]');
    process.exit(2);
  }
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const files = renderAll(version.replace(/^v/, ''), parseSums(readFileSync(sumsPath, 'utf8')), {
    icon: readFileSync(join(root, 'build-resources', 'icon.png')),
    license: readFileSync(join(root, 'LICENSE')),
  });
  for (const [rel, text] of Object.entries(files)) {
    const path = join(outDir, rel);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
    console.log('wrote', path);
  }
}
