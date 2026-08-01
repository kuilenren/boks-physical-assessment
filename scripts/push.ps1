$ErrorActionPreference = 'Stop'

$branch = git branch --show-current
if ([string]::IsNullOrWhiteSpace($branch)) {
  throw '当前不在有效 Git 分支上。'
}

git push origin $branch
