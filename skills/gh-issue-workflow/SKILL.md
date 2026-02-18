---
name: gh-issue-workflow
description: Run a full GitHub issue delivery workflow with git and gh CLI. Use when an agent needs to publish issues, select the highest-priority issue from a GitHub Project board, implement on a feature branch, open a PR, and move the item to In review.
---

# GitHub Issue Workflow

Follow this workflow for every issue. Complete one issue at a time.

## Prerequisites

- Authenticate `gh` with scopes `repo`, `read:project`, and `project`.
- Confirm repo remote points to the intended GitHub repository.
- Start from updated `main`.

```bash
git checkout main
git pull --ff-only origin main
```

## Project Setup (once per repo/board)

Set environment variables:

```bash
OWNER="Stahhl"
REPO="dunder_mifflin"
PROJECT_NUMBER="7"
PROJECT_ID="PVT_kwHOAxlFjs4BO3BE"
STATUS_FIELD_ID="PVTSSF_lAHOAxlFjs4BO3BEzg9cBZc"
STATUS_BACKLOG_ID="f75ad846"
STATUS_READY_ID="61e4505c"
STATUS_IN_PROGRESS_ID="47fc9ee4"
STATUS_IN_REVIEW_ID="df73e18b"
STATUS_DONE_ID="98236657"
```

To confirm field/option IDs:

```bash
gh project field-list "$PROJECT_NUMBER" --owner "$OWNER" --format json
```

## Publish New Issues

When new work needs to be tracked, publish an issue and add it to the board.

```bash
ISSUE_URL=$(gh issue create \
  --repo "$OWNER/$REPO" \
  --title "Short actionable title" \
  --body "Context, acceptance criteria, and constraints.")

ISSUE_NUMBER="${ISSUE_URL##*/}"

gh project item-add "$PROJECT_NUMBER" --owner "$OWNER" --url "$ISSUE_URL"

ITEM_ID=$(gh project item-list "$PROJECT_NUMBER" --owner "$OWNER" --format json \
  --jq ".items[] | select(.content.number == $ISSUE_NUMBER) | .id")

gh project item-edit \
  --id "$ITEM_ID" \
  --project-id "$PROJECT_ID" \
  --field-id "$STATUS_FIELD_ID" \
  --single-select-option-id "$STATUS_BACKLOG_ID"
```

Set priority (`P0`, `P1`, `P2`) if the board has a priority field.

## Pick the Most Important Issue

Selection rule:

1. Prefer `Ready` over `Backlog`.
2. Within same status, prefer `P0` > `P1` > `P2` > unset.
3. Break ties by smallest issue number.
4. Skip items that already have linked pull requests.

Get one candidate:

```bash
gh project item-list "$PROJECT_NUMBER" --owner "$OWNER" --format json --jq '
  .items
  | map(select(.content.type == "Issue"))
  | map(select(.status == "Ready" or .status == "Backlog"))
  | map(select((."linked pull requests" | length) == 0))
  | sort_by(
      (if .status == "Ready" then 0 else 1 end),
      (if .priority == "P0" then 0 elif .priority == "P1" then 1 elif .priority == "P2" then 2 else 3 end),
      .content.number
    )
  | .[0]
' 
```

Claim the chosen issue:

```bash
ISSUE_NUMBER="<chosen-issue-number>"
ITEM_ID="<chosen-item-id>"
ME=$(gh api user -q .login)

gh issue edit "$ISSUE_NUMBER" --repo "$OWNER/$REPO" --add-assignee "$ME"

gh project item-edit \
  --id "$ITEM_ID" \
  --project-id "$PROJECT_ID" \
  --field-id "$STATUS_FIELD_ID" \
  --single-select-option-id "$STATUS_IN_PROGRESS_ID"
```

## Branch, Build, and Push

Create an issue-linked feature branch:

```bash
TITLE_SLUG=$(gh issue view "$ISSUE_NUMBER" --repo "$OWNER/$REPO" --json title -q '.title' \
  | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-' | sed 's/^-//; s/-$//' | cut -c1-30)

BRANCH="codex/issue-${ISSUE_NUMBER}-${TITLE_SLUG}"

gh issue develop "$ISSUE_NUMBER" --repo "$OWNER/$REPO" --base main --name "$BRANCH" --checkout
```

Implement the change, run relevant tests, then commit and push:

```bash
git add -A
git commit -m "feat: resolve issue #$ISSUE_NUMBER"
git push -u origin "$BRANCH"
```

## Open PR and Move to Review

Create PR with issue linkage:

```bash
gh pr create \
  --repo "$OWNER/$REPO" \
  --base main \
  --head "$BRANCH" \
  --title "Resolve #$ISSUE_NUMBER: <short title>" \
  --body "Closes #$ISSUE_NUMBER"
```

Move the project item to `In review`:

```bash
gh project item-edit \
  --id "$ITEM_ID" \
  --project-id "$PROJECT_ID" \
  --field-id "$STATUS_FIELD_ID" \
  --single-select-option-id "$STATUS_IN_REVIEW_ID"
```

Post a short issue comment with what changed, tests run, and PR URL.

## After Merge

- Do not manually move status to `Done`; project automation handles this after review.
- Delete feature branch locally and remotely.
- Keep issue/PR trail intact; do not squash away issue reference context.

## Guardrails

- Never push directly to `main`.
- Never force-push to shared branches.
- Never move to `Done` before PR is merged.
- Never mix unrelated work into the same branch/PR.
- If blocked, comment on the issue with blocker details and move status back to `Ready`.
