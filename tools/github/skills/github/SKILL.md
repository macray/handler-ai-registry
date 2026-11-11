---
name: github
description: Work on GitHub with the GitHub CLI (`gh`) and git — repositories, branches, pushes, pull requests, issues, reviews, Actions runs, releases, `gh api`. Use whenever the task involves GitHub, a github.com remote, or the `gh` command.
---

# GitHub

The GitHub CLI is installed (`gh`), already logged in as the account of one token:

- `GH_TOKEN` authenticates every `gh` command: **never run `gh auth login`, `gh auth logout` or
  `gh auth refresh`**, and never print, echo or write the token anywhere (`gh auth token`
  included).
- git uses the same token for github.com over HTTPS, with nothing to set up: `git clone`, `fetch`
  and `push` just work. SSH remotes (`git@github.com:…`) are rewritten to HTTPS; SSH itself is not
  available here. Never change the remote's URL to put a token in it.
- What you can do is what the token's account may do, on the repositories it was given: a `403`
  or `Resource not accessible by personal access token` means the token does not allow it. Say so
  to the person; do not look for another way in.

`gh auth status` shows which account that is.

## How to call `gh` well

For structured output (`--json`, `--jq`), pagination and silent truncation (`-L`, `--paginate`),
targeting a repository (`-R owner/repo`), search versus list and falling back to `gh api`, read
GitHub's own guide, written for this version of `gh`:
`/opt/tools/github/docs/gh-skill.md`. Read it before your first non-trivial `gh` command.

## Safe (no confirmation needed)

- reading anything: `gh repo view`, `gh pr list/view/diff/checks`, `gh issue list/view`,
  `gh run list/view`, `gh release list/view`, `gh search …`, `gh api` with `GET`;
- creating and pushing a **new branch** of yours, and opening a pull request from it
  (`gh pr create --draft` unless asked otherwise, with `--title` and `--body`);
- commenting on pull requests and issues of the task, and creating an issue when asked to.

## Ask the person first, always

- merging, or approving, a pull request (`gh pr merge`, `gh pr review --approve`);
- pushing to the default branch or to a branch you did not create, and any force push
  (`--force`, `--force-with-lease`);
- deleting anything (a branch, a release, a tag, a repository, a comment), closing someone else's
  issue or pull request;
- releases and tags (`gh release create`, `git push --tags`), re-running or cancelling workflows
  (`gh run rerun/cancel`, `gh workflow run`);
- changing settings, secrets, variables, collaborators, branch protection or webhooks
  (`gh repo edit`, `gh secret`, `gh variable`, `gh api` with `POST`/`PATCH`/`PUT`/`DELETE` on them);
- creating a repository, a fork or a gist.

## Known limits

- github.com only: no GitHub Enterprise Server host.
- There is no browser to open: never pass `--web`; for a link, `gh browse --no-browser` (or the
  `url` field of `--json`) prints it, give it to the person.
- Nothing prompts: a command missing a value it would ask for (`gh pr create` without `--title`
  and `--body`) fails at once instead. Pass every value as a flag.
