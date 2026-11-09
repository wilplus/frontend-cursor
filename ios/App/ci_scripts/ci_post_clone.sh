#!/bin/sh
# Xcode Cloud runs this right after it clones the repository, before it
# resolves the Swift packages. The iOS project reads the Capacitor plugins
# from node_modules (ios/App/CapApp-SPM/Package.swift), and the files
# `cap sync` generates (ios/App/App/capacitor.config.json, ios/App/App/public)
# are not in git, so this does what a Mac does before a build:
# `npm ci && npx cap sync ios`, with the Node version in .nvmrc (22).
# Xcode Cloud finds it because it sits in ci_scripts/ beside App.xcodeproj.
set -eu

export HOMEBREW_NO_AUTO_UPDATE=1
export HOMEBREW_NO_INSTALL_CLEANUP=1
brew install node@22
PATH="$(brew --prefix node@22)/bin:$PATH"
export PATH

cd "${CI_PRIMARY_REPOSITORY_PATH:-$(dirname "$0")/../../..}"
node --version
# --ignore-scripts: the site's own postinstall (the PDF worker copy) is not
# part of the app; the Capacitor packages need no install scripts.
npm ci --ignore-scripts --no-audit --no-fund
npx cap sync ios
