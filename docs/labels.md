# Labels

`labels.yml` is the shared label set for every repo in the org: `type:`, `area:`, `priority:` and
`status:` groups, plus `dependencies` (Dependabot) and `good first issue`.

Sync it with the GitHub CLI (`gh auth login` first, Node 22 or newer, no install step):

```sh
# show what would change, touch nothing
node scripts/sync-labels.mjs --dry-run aldra-systems/aldra-newsletter

# create and update labels in the given repos
node scripts/sync-labels.mjs aldra-systems/aldra-newsletter aldra-systems/brand

# no repo given: every non-archived repo of the org
node scripts/sync-labels.mjs

# also delete labels that are not in the file (off by default)
node scripts/sync-labels.mjs --prune
```

Matching is by name, case-insensitive. Changing a label means editing `labels.yml` and running the
script again. Dependabot configs must use the exact names from the file (`area: ci`, with the space).
