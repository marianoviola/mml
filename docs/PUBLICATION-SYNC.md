# Publication sync

The series *The Lifecycle Transition* on marianoviola.com is the reference
for definitions; `bundles/<version>/` is the reference for numbers. This
file records where the two disagreed, what was decided, and the errata the
published parts need. Published parts are changed only with a version note
and an errata entry; the model is changed to follow the chapters where the
chapters are right.

## Decisions taken with model 0.2.0

1. **€450 is the budget for the fixed Mobility Rate** (Part 2, §2.3): energy
   estimated and paid separately, insurance and finance inside the rate.
   Part 1's national envelopes are a different perimeter (COICOP CP071 +
   CP072: purchase and operation including fuel, excluding insurance and
   interest) and are kept as context, not as the product constraint. The
   model reports both, and the expected total, in every quote.
2. **The contribution to the Material Capital Credit is a line of the fixed
   rate** (Part 2, §2.3 and §2.5), disclosed separately and outside the
   margin. The model charged nothing for it before 0.2.0; the credit was a
   gift from the fleet. It is now the material floor spread over the term,
   €17.85 a month on the Corolla over 60 months.
3. **Fleet stock is priced at the model's own mobility value**, so ownership
   and rental of a later life compare on the valuation MML uses.

## Errata for published parts

### Part 1, "The €450 question" (30/08/2026)

- §1.1, opening request "I need a family car. I can spend €450 a month.":
  add, once, what the €450 is for. Proposed: *"€450 a month for the fixed
  rate; fuel on top, as it always is."* The model's household declares
  the same.
- §1.1, Figure 1 methodology note ("Insurance and financing interest are
  excluded"): add a sentence that this is the statistical perimeter of
  household spending, not the Mobility Rate of Part 2, which includes
  both; the model reports the Corolla on this basis at €494 for the third
  life, so the reader can put it against Italy's €339.
- Version note: *v1.1, September 2026: perimeter of the €450 stated;
  numbers unchanged.*

### Part 2, "The lifecycle is the product" (07/09/2026)

- Table 2.1, Family Touring, "€450 monthly-equivalent design constraint":
  say *"€450 fixed Mobility Rate, energy separate"*. This is the reading
  the rest of the chapter already implies.
- §2.3, the illustrative fixed-rate band "€430 and €480 per month
  equivalent": true of the vehicle's second and third lives (€489 and
  €435 in model 0.2.0), not of a new placement (€600). Proposed: *"for a
  later-life placement of the reference vehicle, between about €430 and
  €490 a month; a new one is nearer €600."* Or cite the bundle.
- §2.2, hail example, "€38,000 asset" and "€7,000 of damage": the
  reference vehicle lists at €35,500 (Toyota Motor Italia, MY26); the
  model's hail event is a €600 local repair against €2,800 for the panel,
  and about €7,000 of *resale value* lost under ownership. If the €7,000
  is meant as value loss rather than repair cost, say so; if the €38,000
  is a round illustration, keep it and say "about".
- Version note: *v1.1, September 2026: the €450 constraint is on the fixed
  rate; the fixed-rate band refers to later lives; hail example figures
  labelled. Numbers otherwise unchanged.*

### Part 3, "Designing the asset" (15/09/2026)

No numeric claims; concepts match the model (three stages in
`lifecycle.stage`, three asset states, repair before replacement, the
Vitara in the fixtures). No erratum.

## Completion of the web series, model 0.2.1 (9 October 2026)

Parts 4–13 have now been revised and published in the Website repository.
The full chapter-by-chapter boundary is in `PUBLICATION-ALIGNMENT.md`.
Historical errata above refer to the 0.2.0 reconciliation and are retained.

- Part 6's household is illustrative: four people, 15,000 km/year, €450
  fixed-rate budget. It does not receive a calculated quotation.
- Part 7 distinguishes existing industrial activities from a proposed
  integrated network; demand arithmetic is labelled hypothetical.
- Parts 8–9 make employment and financing conditional, without net-job,
  cheap-capital or insolvency-protection guarantees.
- Part 10 exposed an additive double count: the old continuation rule added
  two whole-asset component and material proxies. Model 0.2.1 uses their
  maximum as an alternative-route benchmark. It does not optimise a mixed
  dismantling plan. Regression tests cover continuation, retirement and ties.
  The legacy output key `valueAsComponentsAndMaterial` is retained for API
  compatibility; its derived formula now states the alternative-route rule.
- Parts 11–12 separate regulation, policy context, environmental outcomes
  and governance requirements from model outputs.
- Part 13 cites the 0.2.1 bundles. The reference household travels 20,000
  km/year, has no home charging, fifteen years of licence history and a
  60-month term in Lombardy. Central third-life fixed rate €435 plus energy
  €172 gives €607; optimistic €372/€146/€517; adverse €558/€198/€756.
  Components are rounded independently. New central MML is €600 fixed,
  versus modelled ownership €580 and rental €524. No universal cost
  advantage is claimed. MCC €17.85/month is inside the fixed rate.

The correction changes continuation recovery values and bundle hashes, not
pricing inputs. Published 0.2.0 bundles remain immutable. Canonical new
results are in `bundles/0.2.1/` with source revision and hashes. Web completion
does not imply PDF/EPUB publication, operational readiness or a finished model.
