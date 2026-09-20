---
name: Bug report
about: Report a problem with datapact
title: "[Bug]: "
labels: bug
assignees: ""
---

**What happened**

A clear description of the incorrect behavior. Include the command you ran and
the output you saw. If a rule fired when it should not have, or did not fire when
it should, name the rule code (`DP-*`).

**Expected behavior**

What you expected datapact to do instead.

**Reproduction**

Minimal steps and, if possible, a small contract and CSV that reproduce the
issue. Redact anything sensitive; datapact never transmits your files.

```bash
datapact check --contract contract.yaml --data data.csv
```

**Contract and data**

- Logical type(s) involved:
- Format(s) involved, if any:
- Report the relevant rule code(s):

**Environment**

- OS:
- Bun version (`bun --version`):
- datapact version or revision:
- Install method (from source, package manager):
