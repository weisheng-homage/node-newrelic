#! /bin/sh

# Copyright 2020 New Relic Corporation. All rights reserved.
# SPDX-License-Identifier: Apache-2.0

PACKAGE_VERSION=$(node -e 'console.log(require("./package").version)')

git fetch origin gh-pages
git checkout gh-pages
git merge -
npm run public-docs
git rm -r docs
mv out docs
git add docs
git commit -m "docs: update for ${PACKAGE_VERSION}"
git push origin gh-pages
