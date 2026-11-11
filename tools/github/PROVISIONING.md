# GitHub tool — the token an agent needs

An agent is unsupervised: what limits it is the **account behind its token**, not the skill
(a skill is only words the agent reads). The skill asks the agent to check with you before merging,
pushing to the default branch or deleting anything; GitHub enforces only what the token allows.

## 1. Whose account

- **A machine account** (a second GitHub account for the agent, e.g. `you-agent`, added as a
  collaborator with *Write* on the repositories it works on): its commits, pull requests and
  comments show as the agent's, and its rights are only those you gave it. Preferred.
- **Your own account**, with a token limited as below: simpler, but everything the agent does
  shows as you.

Never give it a classic token (`ghp_…`) with the `repo` scope: it reaches every repository of the
account, with every right.

## 2. A fine-grained personal access token

On the account the agent uses: **Settings → Developer settings → Personal access tokens →
Fine-grained tokens → Generate new token**.

- **Resource owner**: the user or the organization owning the repositories. A token reaches one
  owner only: an agent working on two organizations needs a token per organization, hence two
  connections, used by two agents (an agent has one connection to a tool).
- **Expiration**: a date (90 days, say); you renew it in your password store, nothing else changes.
- **Repository access**: *Only select repositories*: those the agent works on.
- **Permissions** (repository), for an agent that pushes branches and opens pull requests:

  | Permission | Access |
  |---|---|
  | Contents | Read and write (push branches) |
  | Pull requests | Read and write |
  | Issues | Read and write (or Read only) |
  | Actions | Read (runs and their logs) |
  | Commit statuses, Checks | Read |
  | Metadata | Read (always) |

  Add *Workflows: Read and write* only if it must change `.github/workflows/`. Leave out
  Administration, Secrets, Variables, Webhooks, Environments.

  A **reviewer** agent gets the same with Contents *Read*: a second connection with its own
  token (section 4).

Keep it in your password store, never in a file under a folder agents can read:

```bash
pass insert github/agent-token
```

## 3. Protect the default branch

On each repository: **Settings → Rules → Rulesets → New branch ruleset**, targeting the default
branch: *Require a pull request before merging* (with at least one approval) and *Block force
pushes*. The agent can then push its branches and open pull requests, but `main` only changes when
you merge. If the agent uses a machine account, do not add it to the ruleset's bypass list.

## 4. The connection

```toml
# ~/.config/handler-ai/connections/github-agent.toml
apiVersion  = "handler.connection/v1"
tool        = "github"
description = "you-agent: push branches, pull requests on handler-ai and planner"
secrets     = { token = { command = ["pass", "show", "github/agent-token"] } }
```

Then give `github-agent` to an agent (web UI: **Tools** in the agent's form, or
`handler run … --tool github=github-agent`). Another role, other rights: another
token, another connection (`github-reviewer`, Contents *Read*), given to another agent.

The agent gets a stand-in for the token; the sandbox's proxy puts the real one in its requests to
github.com, api.github.com and uploads.github.com only, for `gh` as for `git push`.

## Advanced: a GitHub App

For tokens that expire within the hour and an identity that is not a person: create a GitHub App
with the permissions above, install it on the repositories, and give the connection a secret
`command` that mints an installation token at each agent start (a short script signing a JWT with
the app's private key, then `POST /app/installations/<id>/access_tokens`). The token then expires
on its own an hour after the session starts: a longer session loses access.
