# 11: GitHub repo + push

**What to build:** The monorepo lives on GitHub and CI runs there. Create a
(private) GitHub repository, add it as the `origin` remote, push `main`, and
confirm the `CI` workflow runs and passes on the pushed commit.

**Blocked by:** 01

**Status:** done

- [x] GitHub repo created (private recommended)
- [x] `git remote add origin <url>` and `git push -u origin main`
- [x] The `CI` workflow appears under the Actions tab and passes (lint + typecheck + test)
- [x] Branch protection on `main` optional but recommended: require the CI check to pass before merge

## Notes

- `gh repo create <name> --private --source=. --remote=origin --push` does all of this in one command if the GitHub CLI is authenticated.
