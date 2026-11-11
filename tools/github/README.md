# GitHub

Lets agents work on GitHub with the GitHub CLI (`gh`) and git over HTTPS: clone and push branches,
open and review pull requests, read issues and Actions runs, call the API, all as the account of
one token you give.

- **Needs**: a fine-grained personal access token, limited to the repositories the agent works on
  (`PROVISIONING.md` says which permissions, and how to protect your default branch).
- **Reaches**: github.com, api.github.com, uploads.github.com, codeload.github.com and
  `*.githubusercontent.com`. The token is only sent to the first three; the agent gets a stand-in.
- **Skill**: `github`, what the agent may do alone and what it asks you first (merging, pushing to
  the default branch, deleting, releases, settings). It points to GitHub's own guide to `gh`,
  installed with each version of `gh`.
- **Updates**: every rebuild of the image installs the latest `gh` release.

github.com only, not GitHub Enterprise Server.
