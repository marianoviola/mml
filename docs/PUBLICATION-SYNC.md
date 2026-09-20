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

## Part 4, in preparation

What the model can supply, with hashes, from `bundles/0.2.0/four-fifty.central.json`:

- the hierarchy Mobility / Component / Material Capital, on the Corolla at
  eight years and 152,000 km: €13,621 / €8,520 / €1,190;
- the credit floor at 90% of Material Retention Value (one method,
  labelled; §2.5 left it open) and its linear build over the term;
- the continuation rule: continue while repaired value exceeds harvest
  value, and say that the next significant repair reopens the question
  when the margin is under 10%;
- the break-even quantities: 23 years of structural life or fleet capital
  at 1.7% for MML to cost what rental costs on a new placement; 27 years
  on the third life;
- the adverse and optimistic sets as the chapter's range.

## Model-only assumptions the site's methodology note should state

Fifteen years of licence, Lombardy, no home charging, a 60-month term at
20,000 km: the household the model runs is more specific than the chapters
describe. They are inputs, not findings.
