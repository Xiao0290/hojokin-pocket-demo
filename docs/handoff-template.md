# Handoff Template

Use this template when ending a PR, handing work to another engineer or agent, or pausing an incomplete branch.

## Context

- Issue:
- Branch:
- PR:
- Current status:

## Goal

State the outcome this work is intended to deliver.

## What Changed

- 

## Files Touched

- 

## Validation

- [ ] `npm run verify:ci`
- [ ] GitHub Actions passed
- [ ] Browser check attached, if UI changed
- [ ] Source or fixture re-check documented, if data changed

## Decisions Made

- 

## Risks and Follow-ups

- 

## Legal / Data Gates

- [ ] Track L1 checked if the work touches marketplace, payment split, success-contingent fee, delegated filing, AI final-document claims, or adoption-rate claims.
- [ ] Track L2 checked if the work depends on legal/API/data research answers.
- [ ] Track L3 checked if the work stores, transforms, displays, or redistributes external source data.
- Red lines:
- Unconfirmed items:
- Product implications:

## Resume Instructions

1. 

## Useful Commands

```sh
git status -sb
npm run verify:ci
gh pr view --web
```
