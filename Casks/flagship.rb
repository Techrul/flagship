cask "flagship" do
  version "0.4.0"
  sha256 "4b3c7043b293e01d8cb38e77996094e25960f74dcb434b2b26fad2c71dd11c46"

  url "https://github.com/Techrul/flagship/releases/download/v#{version}/Flagship-#{version}-mac-universal.zip"
  name "Flagship"
  desc "A launcher for Scratch games, powered by TurboWarp (vibe-coded)"
  homepage "https://github.com/Techrul/flagship"

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
