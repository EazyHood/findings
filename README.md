# Findings

Bugs I have found in other people's software, with the link to where a third party decided what to
do about it.

Every row below points at a public issue or pull request in a repository I do not control. The
outcome column is not my claim — it is what the maintainers did. Where something is still open, it
says so.

<!-- AUTO:TOTALS -->
**Totals as of 2026-09-05:** 220 pull requests opened, **60 merged**; 63 issues opened, 19 closed. Across 19 organizations. The complete list is in [RECORD.md](RECORD.md), regenerated automatically.

Two honest notes on those totals. First, 42 of the 60 merges come from two high-volume repositories (`Chain-Love/chain-love` and `Hazyshades/Sendly-Test-Repo`) where the work was individually small — the range is better shown by the other 18. Second, 44 of the 63 issues are still open, which is ordinary for issues filed against large projects and is not evidence of anything either way.
<!-- /AUTO:TOTALS -->

---

## Numerical accuracy

Kernel and special-function work: cases where a function returns a plausible-looking number that is
wrong, which is the failure mode no type checker catches.

| Finding | Where | State |
| --- | --- | --- |
| `lgamma` (fp32) returns one identical value for all 167,773 floats in a range | [tenstorrent/tt-metal#51976](https://github.com/tenstorrent/tt-metal/issues/51976) | open |
| `ttnn.div` returns 0 for large denominators — `a/a` is 0 instead of 1 | [tt-metal#52094](https://github.com/tenstorrent/tt-metal/issues/52094) | open |
| `sin`/`cos` lose all accuracy past \|x\| ≈ 1.04e5 and return \|result\| > 1 | [tt-metal#51845](https://github.com/tenstorrent/tt-metal/issues/51845) | open |
| `softplus` (bf16) returns exactly 0 for x < −5, breaking its (0, ∞) range | [tt-metal#51866](https://github.com/tenstorrent/tt-metal/issues/51866) | open |
| `xlogy` NaN guard is dead code: `in1 == nan` can never be true | [tt-metal#52036](https://github.com/tenstorrent/tt-metal/issues/52036) | open |
| `tril`/`triu` composed as a mask multiply, so an ∞ in the masked region survives | [tt-metal#52038](https://github.com/tenstorrent/tt-metal/issues/52038) | open |
| The variance composite returns an exact 0 below a threshold | [tt-metal#52614](https://github.com/tenstorrent/tt-metal/issues/52614) | open |
| `kelvin`: a shared \|x\| < 10 branch point costs `ber`/`bei`/`berp`/`beip` about 6 digits | [scipy/xsf#232](https://github.com/scipy/xsf/issues/232) | open |

## A library that breaks its own documented contract

Three defects in Mudlet's Lua table library, all merged. Each one is a case where the code and the
function's own docblock disagree.

| Finding | Where | State |
| --- | --- | --- |
| `table.union` mutates a table it was given, and aliases it into the result | [Mudlet#9613](https://github.com/Mudlet/Mudlet/pull/9613) | **merged** |
| `compare()` reports two identical tables as different when they hold `false` | [Mudlet#9614](https://github.com/Mudlet/Mudlet/pull/9614) | **merged** |
| `table.n_collect` silently drops values that match an index | [Mudlet#9615](https://github.com/Mudlet/Mudlet/pull/9615) | **merged** |

`compare()` is the one I would point at. Only `false` is affected, because the existence check was a
truthiness test — `0` and `""` pass, `false` does not. That is why it survived in a widely used
client for years.

## Authentication and security

| Finding | Where | State |
| --- | --- | --- |
| An unreadable token expiry is treated as *no expiry*, so the token is cached forever. Six input shapes measured, including epoch milliseconds | [call-e-integrations#72](https://github.com/CALLE-AI/call-e-integrations/pull/72) | **merged** |
| `apn.tech` sends no `Strict-Transport-Security` header, so the first visit is unprotected | [APN-Network/bugs#197](https://github.com/APN-Network/bugs/issues/197) | **closed, fixed** |
| Password field has no accessible name; a placeholder is its only label | [APN-Network/bugs#195](https://github.com/APN-Network/bugs/issues/195) | **closed** |
| Upload path did not enforce accepted MIME types and extensions | [Sendly#150](https://github.com/Hazyshades/Sendly-Test-Repo/pull/150) | **merged** |

## Cross-platform: what a Linux-only team cannot see

This is the cluster I did not plan and now watch for deliberately. I develop on Windows, so I hit a
class of breakage that never appears in a CI matrix that does not include it.

| Finding | Where | State |
| --- | --- | --- |
| Two ingest paths hardcoded to `/tmp`, which does not exist on Windows | [datahub#18811](https://github.com/datahub-project/datahub/pull/18811) | **merged** |
| The CUDA torch index is gated to Linux, so Windows silently installs a CPU-only build | [ScrollPrize/villa#1584](https://github.com/ScrollPrize/villa/pull/1584) | **merged** |
| `cmd.exe` mangles the OAuth URL, so `auth login` fails silently | [call-e-integrations#71](https://github.com/CALLE-AI/call-e-integrations/pull/71) | **merged** |
| Plugin/skill validators broken on Windows — 6 failing tests to 0 | [call-e-integrations#70](https://github.com/CALLE-AI/call-e-integrations/pull/70) | **merged** |

## Data and catalogue integrity

Comparing what a project publishes about its data against the data itself.

| Finding | Where | State |
| --- | --- | --- |
| Scroll 3 catalogued under 54 keV when its only volume is a different energy | [ScrollPrize/villa#1581](https://github.com/ScrollPrize/villa/pull/1581) | **merged** |
| The `schema.json` published in the wiki is 6 definitions and 22 fields behind the data | [chain-love#2482](https://github.com/Chain-Love/chain-love/issues/2482) | **closed** |
| Three columns documented as never-blank are missing entirely from many rows | [chain-love#2480](https://github.com/Chain-Love/chain-love/issues/2480) | **closed** |
| 36 of 42 `services.csv` listings order two columns against the documented order | [chain-love#2684](https://github.com/Chain-Love/chain-love/issues/2684) | **closed** |

## Build and packaging

| Finding | Where | State |
| --- | --- | --- |
| A demo repo that does not compile against the SDK its own `package.json` resolves — a caret range on `^4.2.0` pulling `4.46.0`, five breakage points across two files | [BUGS.md §1](https://github.com/EazyHood/t3n-supplier-diligence-agent/blob/main/BUGS.md) | reported to sponsor |
| A single line larger than `CHUNK_SIZE` was never split, returning HTTP 400 on one-line inputs | [paritok-4b-v1#15](https://github.com/Paritok-official/paritok-4b-v1/pull/15) | **merged** |
| `testIntegrationBatch1` segfaults on master after the tests pass; exit 139 reported as success | [datahub#18820](https://github.com/datahub-project/datahub/issues/18820) | open |
| Three sources disagree on whether Python 3.12 is supported | [datahub#18819](https://github.com/datahub-project/datahub/issues/18819) | open |

---

## How I write one

The shape is always the same, and the middle step is the one that matters.

1. **Reproduction.** The exact command or the exact input, and its output pasted rather than
   described.
2. **A control.** Evidence that it is not my machine. For the SDK case above I cloned the repository
   twice — once to work in, once untouched in a separate directory — and installed from scratch in
   both, so the report could not be closed as an environment problem. For a line-ending defect I
   found more recently, the control was the same clone with one git setting changed: one branch
   produced 15 errors, the other produced a clean run, same machine, same commit.
3. **Root cause**, in the project's own code, quoted.
4. **The fix**, when I have one I am confident in — and an explicit note when I do not. A fix I
   cannot verify is worse than no fix, and I would rather say a case is inconclusive than guess in
   a way that looks decisive.

The measurement discipline matters more than the volume. A number I cannot reproduce does not go in
the report, and neither does a negative result I have not checked with a positive control.

## How this page stays current

The totals above and [RECORD.md](RECORD.md) are rebuilt from the GitHub API by
[`scripts/update.mjs`](scripts/update.mjs), on a schedule, in Actions. No local machine is
involved and nothing here is typed by hand twice.

The curated tables are deliberately **not** generated. A list of titles is not a finding, and the
one-line descriptions are the part worth reading.

Two guards, because a job that silently writes the wrong thing is worse than one that fails:

- If the search returns nothing at all, it refuses to write. A source that always returns
  something returning nothing is an exception, not a result.
- If the totals fall by more than 10% against the previous run, it refuses to write. The record
  only grows, so a drop is a partial response.

Both were tested by breaking them on purpose. The job exits non-zero and leaves the files
untouched.

## The full record

- Issues: <https://github.com/search?q=author%3AEazyHood+type%3Aissue&type=issues>
- Pull requests: <https://github.com/search?q=author%3AEazyHood+type%3Apr&type=issues>

Both links work without a GitHub account.

## Contact

Open an issue here, or reach me through the profile at
[github.com/EazyHood](https://github.com/EazyHood).
