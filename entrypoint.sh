#!/bin/sh 

set -e 

# for local dev. auth with github via git push --dry-run inside of the container
git remote set-url origin https://levibostian:$GITHUB_TOKEN@github.com/levibostian/semantic-release-precheck.git

npx semantic-release --dry-run --debug