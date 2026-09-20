# Canonical bundles

One directory per model version, written by `mml bundles` and reproduced by
CI from a clean checkout. Nothing here is edited by hand.

```text
bundles/<version>/
  index.json                 model version and commit, fixture hashes, one entry per assumption set with its hash and the bundle's output hash
  four-fifty.<set>.json      the €450 scenario end to end under that set: every step, every number with its kind
  modes.csv                  ownership / long-term rental / MML, fixed, variable and all-in, per placement and set
  sensitivity.csv            Δ €/month per +10% on each input, per mode, placement and set
  break-even.csv             the input value at which MML meets the budget or costs what rental costs, per placement and set; empty when none in range
```

The output hash covers the assumption set, the household and the steps, not
the timestamp or the commit, so two runs of the same model on the same
fixtures produce the same hash. The publication cites a version directory
and reads these files; it never runs the model.
