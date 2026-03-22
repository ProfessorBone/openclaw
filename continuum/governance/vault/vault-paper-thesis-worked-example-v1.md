# Vault Paper Thesis: Worked Example v1

**Artifact ID:** PACS-VAULT-GOV-001-EXAMPLE
**Version:** 1.0
**Status:** Locked
**Package:** PACS-VAULT-GOV-001
**Scope:** capital_domain: trading | mode: paper
**Capital authorized:** None
**Created:** 2026-03-21

---

## Cross-References

| Artifact                                 | Relationship                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------- |
| `vault-paper-thesis-template-v1.md`      | Defines the record structure this specimen conforms to                    |
| `vault-thesis-operating-procedure-v1.md` | Defines the state transitions this specimen walks through                 |
| `vault-governance-checklist-v1.md`       | Defines the gates and taint conditions this specimen is evaluated against |
| `SOUL.md` (Vault section)                | Upstream authority for governance principles                              |
| `DECISIONS.md` — ADR-039                 | Activates the infrastructure this specimen operates on                    |

---

## Purpose

This is a pressure-test specimen. It exists to exercise every field in the Vault Paper Thesis Template and every gate in the Vault Governance Checklist. It is not investment advice. It is a governance calibration artifact.

---

## The Thesis Record

### Section A. Identity and Governance

```json
{
  "thesis_id": "VPT-2026-001",
  "record_version": 1,
  "created_at": "2026-03-21T14:00:00Z",
  "updated_at": null,
  "capital_domain": "trading",
  "mode": "paper",
  "analyst_engine": "narrative",
  "upstream_engines": [],
  "bridge_policy_version": "bridge-v1.2.0"
}
```

### Section B. Asset and Strategy

```json
{
  "asset_symbol": "SPY",
  "asset_type": "broad_market_etf",
  "strategy_bucket": "trend_following",
  "directional_view": "long",
  "time_horizon": "30_calendar_days"
}
```

**Design note:** SPY is chosen because it is the most likely candidate to exist in any reasonable allowed-universe configuration. If this specimen fails the asset-allowed gate, the Bridge config itself needs review, not the thesis.

### Section C. Thesis Core

```json
{
  "thesis_statement": "The S&P 500 is likely to appreciate over the next 30 calendar days based on sustained institutional inflow data, improving breadth metrics, and a Federal Reserve posture that remains accommodative relative to market expectations.",
  "supporting_evidence": [
    {
      "statement": "Weekly fund flow data shows net positive institutional inflows into US large-cap equity funds for seven consecutive weeks.",
      "source_ref": "SRC-001",
      "evidence_type": "quantitative",
      "added_at": "2026-03-21T14:00:00Z",
      "notes": "Flow data is a lagging indicator but sustained direction over seven weeks reduces noise."
    },
    {
      "statement": "Market breadth as measured by the percentage of S&P 500 constituents trading above their 50-day moving average has expanded from 48% to 67% over the prior three weeks.",
      "source_ref": "SRC-002",
      "evidence_type": "quantitative",
      "added_at": "2026-03-21T14:00:00Z",
      "notes": "Breadth expansion during a rising market reduces the probability that the move is narrow and fragile."
    },
    {
      "statement": "Federal Reserve communications in the most recent FOMC minutes indicate no near-term intent to tighten beyond current levels, and market-implied rate expectations remain stable.",
      "source_ref": "SRC-003",
      "evidence_type": "qualitative",
      "added_at": "2026-03-21T14:00:00Z",
      "notes": "Fed posture is assessed qualitatively because forward guidance language requires interpretation, not just data reading."
    }
  ],
  "counterevidence": [
    {
      "statement": "Equity risk premium has compressed to levels historically associated with below-average forward 1-year returns.",
      "source_ref": "SRC-004",
      "evidence_type": "quantitative",
      "added_at": "2026-03-21T14:00:00Z",
      "notes": "ERP compression is a valid long-term concern but has poor timing value on a 30-day horizon. Acknowledged as structural risk, not a timing signal."
    },
    {
      "statement": "Geopolitical risk in the Taiwan Strait remains elevated, and a military escalation scenario would likely cause a rapid broad-market drawdown.",
      "source_ref": "SRC-005",
      "evidence_type": "structural",
      "added_at": "2026-03-21T14:00:00Z",
      "notes": "Tail risk. Low probability but high impact. This is why the invalidation condition includes an exogenous shock clause."
    }
  ],
  "invalidation_condition": "Thesis is invalidated if: (1) SPY closes below its 50-day moving average for three consecutive sessions, OR (2) a material exogenous shock produces an intraday drawdown exceeding 3% from the entry price, OR (3) Federal Reserve communications shift to explicitly hawkish forward guidance before the time horizon expires.",
  "confidence_level": 0.6,
  "uncertainty_statement": "Confidence is moderate because the supporting evidence is directionally aligned but none of the individual signals are high-conviction on a 30-day horizon. The thesis depends on the continuation of existing trends rather than a catalyst-driven move, which means it is vulnerable to regime change that the evidence base would not detect in advance."
}
```

### Section D. Source Provenance

```json
{
  "source_list": [
    {
      "source_id": "SRC-001",
      "source_type": "data_provider",
      "source_name": "EPFR Global Weekly Fund Flow Report",
      "accessed_at": "2026-03-20T10:00:00Z",
      "url_or_reference": "https://epfr.com/weekly-flows (subscription required)"
    },
    {
      "source_id": "SRC-002",
      "source_type": "market_data",
      "source_name": "Barchart Market Breadth Dashboard",
      "accessed_at": "2026-03-20T11:30:00Z",
      "url_or_reference": "https://www.barchart.com/stocks/market-breadth"
    },
    {
      "source_id": "SRC-003",
      "source_type": "institutional_publication",
      "source_name": "Federal Reserve FOMC Minutes, March 2026",
      "accessed_at": "2026-03-19T16:00:00Z",
      "url_or_reference": "https://www.federalreserve.gov/monetarypolicy/fomcminutes20260319.htm"
    },
    {
      "source_id": "SRC-004",
      "source_type": "research_report",
      "source_name": "Damodaran Equity Risk Premium Dataset, March 2026 Update",
      "accessed_at": "2026-03-20T09:00:00Z",
      "url_or_reference": "https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/ctryprem.html"
    },
    {
      "source_id": "SRC-005",
      "source_type": "news_analysis",
      "source_name": "Reuters Asia-Pacific Security Brief, March 18 2026",
      "accessed_at": "2026-03-18T22:00:00Z",
      "url_or_reference": "https://www.reuters.com/world/asia-pacific/"
    }
  ],
  "primary_source_summary": "Thesis is primarily supported by quantitative flow and breadth data (SRC-001, SRC-002) with qualitative monetary policy context (SRC-003). Counterevidence draws from valuation research (SRC-004) and geopolitical risk assessment (SRC-005).",
  "market_context_notes": "US equity markets are in a low-volatility regime with VIX below 15. Earnings season has concluded with above-consensus results in aggregate. No major scheduled macro catalysts until the next FOMC meeting."
}
```

### Section E. Pre-Entry Governance Checks

```json
{
  "p1_gate_status": "pass",
  "p1_missing_fields": [],
  "asset_allowed_status": "pass",
  "asset_class_exclusion_status": "pass",
  "segregation_check_status": "pass",
  "sizing_compliance_status": "pass",
  "sizing_violations": [],
  "approval_status": "approved"
}
```

### Section F. Simulated Position Plan

```json
{
  "paper_entry_date": "2026-03-22T09:35:00Z",
  "paper_entry_price": 582.4,
  "simulated_position_size": 10000,
  "max_allowed_notional": 25000,
  "target_condition": "SPY reaches 600.00 or time horizon expires, whichever comes first.",
  "stop_or_exit_condition": "Exit if invalidation condition is triggered. Hard stop at entry price minus 3% (564.73).",
  "planned_review_interval": "weekly"
}
```

### Section G. Lifecycle Tracking

```json
{
  "status": "active",
  "last_review_at": null,
  "policy_divergence_noted": false,
  "closure_date": null,
  "closure_state": null,
  "closure_reason": null
}
```

### Section H. Post-Closure Evaluation

```json
{
  "outcome_summary": null,
  "thesis_quality_assessment": null,
  "evidence_quality_assessment": null,
  "contradiction_handling_assessment": null,
  "discipline_assessment": null,
  "calibration_result": null,
  "evaluator_notes": null
}
```

---

## Gate Walk-Through

This section walks the specimen through every gate in the Vault Governance Checklist to verify compliance.

### Gate 1: draft → validated

| Check                                | Result | Detail                                                                               |
| ------------------------------------ | ------ | ------------------------------------------------------------------------------------ |
| Required identity fields present     | PASS   | thesis_id, capital_domain, mode, analyst_engine, bridge_policy_version all populated |
| Required thesis-core fields present  | PASS   | thesis_statement, invalidation_condition, uncertainty_statement all populated        |
| directional_view explicitly declared | PASS   | Set to "long" (not defaulted; field requires explicit declaration)                   |
| confidence_level valid               | PASS   | 0.6 is numeric, within 0.1-1.0 range                                                 |
| asset_symbol present                 | PASS   | "SPY"                                                                                |
| asset_type present                   | PASS   | "broad_market_etf"                                                                   |
| time_horizon present                 | PASS   | "30_calendar_days"                                                                   |
| source_list non-empty                | PASS   | 5 sources provided                                                                   |
| All source entries complete          | PASS   | Each has source_id, source_type, source_name, accessed_at, url_or_reference          |
| No duplicate source_id values        | PASS   | SRC-001 through SRC-005, all unique                                                  |
| supporting_evidence non-empty        | PASS   | 3 evidence items                                                                     |
| All evidence items complete          | PASS   | Each has statement, source_ref, evidence_type, added_at                              |
| All source_ref values valid          | PASS   | SRC-001, SRC-002, SRC-003, SRC-004, SRC-005 all exist in source_list                 |
| All evidence_type values valid       | PASS   | quantitative (3), qualitative (1), structural (1)                                    |
| capital_domain is "trading"          | PASS   |                                                                                      |
| mode is "paper"                      | PASS   |                                                                                      |

**Gate 1 result: PASS → status transitions to validated**

---

### Gate 2: validated → approved

| Check                               | Result | Detail                                                                  |
| ----------------------------------- | ------ | ----------------------------------------------------------------------- |
| asset_symbol in Bridge-allowed list | PASS   | SPY is a broad_market_etf, which is an allowed-universe category        |
| asset_class not excluded            | PASS   | broad_market_etf is not excluded                                        |
| Segregation check                   | PASS   | Thesis is tagged trading/paper only; no retirement-domain contamination |
| Sizing compliance                   | PASS   | simulated_position_size (10,000) is below max_allowed_notional (25,000) |
| No opening limit violated           | PASS   | Single position, no limit breach                                        |

**Gate 2 result: PASS → status transitions to approved**

---

### Gate 3: approved → active

| Check                       | Result | Detail                                                    |
| --------------------------- | ------ | --------------------------------------------------------- |
| paper_entry_date set        | PASS   | 2026-03-22T09:35:00Z                                      |
| paper_entry_price set       | PASS   | 582.40                                                    |
| simulated_position_size set | PASS   | 10,000 (non-zero)                                         |
| max_allowed_notional set    | PASS   | 25,000 (non-zero)                                         |
| target_condition set        | PASS   | SPY reaches 600.00 or time horizon expires                |
| stop_or_exit_condition set  | PASS   | Invalidation trigger or hard stop at 564.73               |
| planned_review_interval set | PASS   | weekly                                                    |
| State path valid            | PASS   | Transition is from approved (not from draft or validated) |

**Gate 3 result: PASS → status transitions to active**

---

### Gate 4: active → closed (simulated for worked example)

For this specimen, assume the following outcome after 30 calendar days:

> SPY traded in a range between 578 and 591 during the thesis period. It did not reach the 600 target. No invalidation condition was triggered. The thesis expired at the end of the time horizon with SPY at 588.20, representing a modest gain from the 582.40 entry.

Closure record:

```json
{
  "closure_date": "2026-04-21T16:00:00Z",
  "closure_state": "closed-confirmed",
  "closure_reason": "Thesis direction was confirmed: SPY appreciated modestly over the time horizon. Target of 600 was not reached, but directional view (long) was correct and no invalidation condition was triggered. Classified as confirmed rather than inconclusive because the core directional call held and the position would have been profitable at exit."
}
```

| Check               | Result | Detail                                          |
| ------------------- | ------ | ----------------------------------------------- |
| closure_state valid | PASS   | "closed-confirmed" is an allowed terminal state |
| closure_date set    | PASS   | 2026-04-21T16:00:00Z                            |
| closure_reason set  | PASS   | Substantive reason provided                     |

**Gate 4 result: PASS → status transitions to closed**

---

### Gate 5: closed → calibration-recorded (simulated evaluation)

Post-closure evaluation:

```json
{
  "outcome_summary": "SPY gained approximately 1.0% over the 30-day thesis period (582.40 to 588.20). The directional call was correct. The target price of 600 was not reached. No invalidation condition was triggered. The thesis played out within the expected low-conviction, trend-continuation framework.",

  "thesis_quality_assessment": "The thesis was well-structured but modest in ambition. The directional call was correct, but the supporting evidence largely described existing conditions rather than identifying a catalyst. The thesis was essentially a bet on continuation, which is lower-quality than a thesis that identifies an underappreciated driver. For a first calibration specimen, the quality is acceptable. Future theses should aim for at least one evidence item that identifies something the market is not yet pricing.",

  "evidence_quality_assessment": "Quantitative evidence (fund flows, breadth) was specific and verifiable. The qualitative Fed assessment was reasonable but inherently less precise. Counterevidence was honest and well-chosen: the ERP compression note demonstrated awareness of valuation risk even though it was correctly assessed as having poor short-term timing value. The geopolitical tail risk was appropriately flagged as low-probability but high-impact. Overall, evidence quality was solid for a first cycle. The provenance chain from source to evidence is intact and traceable.",

  "contradiction_handling_assessment": "The thesis acknowledged two substantive counterarguments and addressed both with reasoning rather than dismissal. The ERP compression was contextualized as a long-term concern with poor 30-day predictive value. The geopolitical risk was acknowledged as a tail scenario and linked to the invalidation condition. This is the correct handling pattern. The analyst did not ignore or minimize contradictions.",

  "discipline_assessment": "No governance violations occurred. All gates passed on first attempt. No silent edits were made. The thesis ran its full time horizon without early exit or modification. Review cadence was adhered to. The invalidation condition was defined with sufficient specificity to be mechanically evaluable. Position sizing was conservative relative to the allowed maximum. Overall discipline was clean.",

  "calibration_result": "clean",

  "evaluator_notes": "This is the first calibration specimen. It was designed to be conservative and to exercise the full lifecycle rather than to demonstrate analytical sophistication. The thesis quality was adequate but not exceptional. The primary value of this cycle is procedural: it demonstrates that the system can receive, validate, approve, activate, monitor, close, and evaluate a thesis without governance failure. Analytical quality should improve in subsequent cycles now that the procedural path is established."
}
```

| Check                                         | Result | Detail                                                |
| --------------------------------------------- | ------ | ----------------------------------------------------- |
| outcome_summary substantive                   | PASS   | Specific outcome with price levels and assessment     |
| thesis_quality_assessment substantive         | PASS   | Honest evaluation with specific improvement direction |
| evidence_quality_assessment substantive       | PASS   | Per-item assessment with provenance verification      |
| contradiction_handling_assessment substantive | PASS   | Evaluated handling pattern, not just presence         |
| discipline_assessment substantive             | PASS   | Covered governance compliance, sizing, review cadence |
| calibration_result set                        | PASS   | "clean"                                               |
| evaluator_notes substantive                   | PASS   | Contextualized the cycle's purpose and limitations    |

**Gate 5 result: PASS → calibration record created, cycle marked clean**

---

## Integrity Flag Check (9-Flag Sweep)

| Flag                                | Status | Reasoning                                                                                                                                      |
| ----------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| p1_compliance                       | CLEAN  | All IQG fields present, confidence valid, provenance complete, no duplicate source_ids                                                         |
| p2_evaluation_completed             | CLEAN  | All evaluation fields substantive (requires human confirmation)                                                                                |
| p3_segregation_intact               | CLEAN  | Thesis tagged trading/paper only, no cross-domain contamination                                                                                |
| p4_violations_zero                  | CLEAN  | No policy or procedure violations, no gate bypasses                                                                                            |
| a6_alerts_clear                     | CLEAN  | No A6 alerts active during cycle                                                                                                               |
| record_complete_and_auditable       | CLEAN  | Append-only history intact, version sequence complete, updated_at present on all post-creation versions, full provenance chain reconstructable |
| no_unauthorized_asset_breach        | CLEAN  | SPY is allowed, broad_market_etf not excluded, no asset identity change                                                                        |
| no_undocumented_thesis_modification | CLEAN  | No material changes occurred during the cycle                                                                                                  |
| no_output_bypassed_bridge           | CLEAN  | All transitions followed prescribed state path, config read from canonical Bridge path, no fallback config used                                |

**9-flag result: 9/9 CLEAN**
**Cycle result: CLEAN**
**Cycle is eligibility-capable: YES**
**Cycle may be counted now: NO — pending required Bridge reviews (see Bridge Review Trigger Check below)**

---

## Bridge Review Trigger Check

| Trigger                                     | Fired                      | Action Required                                                                                                                                                                                                                                            |
| ------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First-ever thesis activation                | YES                        | Bridge review required before cycle is counted                                                                                                                                                                                                             |
| First-ever clean calibration cycle          | YES                        | Bridge review required before eligibility accounting                                                                                                                                                                                                       |
| Policy divergence during active monitoring  | NO                         | No policy changes during thesis period                                                                                                                                                                                                                     |
| Thesis blocked at approval after validation | NO                         | Approval passed on first attempt                                                                                                                                                                                                                           |
| Sizing within 10% of max_notional           | NO                         | 10,000 is 40% of 25,000 (well below threshold)                                                                                                                                                                                                             |
| Tainted cycle                               | NO                         | Cycle is clean                                                                                                                                                                                                                                             |
| Repeated taint pattern                      | NO                         | First cycle, no history                                                                                                                                                                                                                                    |
| Closure state ambiguity                     | YES, resolved by rationale | Target price was not reached, which could support closed-inconclusive. Classified as closed-confirmed because directional view was correct and position was profitable. Ambiguity was acknowledged and resolved with explicit reasoning in closure_reason. |
| Retirement paper mode request               | NO                         | Not requested                                                                                                                                                                                                                                              |
| Real capital eligibility request            | NO                         | Not requested                                                                                                                                                                                                                                              |

**Bridge review required for:** first-ever thesis activation, first-ever clean calibration cycle, closure state ambiguity resolution.
**All three reviews must be completed and recorded before this cycle counts toward eligibility.**

---

## Pressure Test Results

### What the specimen exercised successfully

- All 8 template sections populated with realistic content
- All 5 source entries with full provenance
- All 5 evidence items with valid source_ref linkage
- Evidence typing across all three allowed categories (quantitative, qualitative, structural)
- Confidence level within valid range with honest uncertainty statement
- All 5 gates passed with explicit per-check verification
- Full lifecycle from draft through calibration
- 9-flag integrity sweep with clean result
- Bridge review triggers correctly identified
- Closure classification with substantive reasoning
- Post-closure evaluation with per-dimension assessment

### What the specimen did NOT exercise

- A failed gate (all gates passed on first attempt)
- A tainted cycle
- A policy divergence during active monitoring
- A thesis that required re-approval after modification
- Multiple record versions (no material changes occurred)
- A sizing decision near the threshold
- counterevidence that actually invalidated the thesis mid-cycle
- The "closed-contradicted" or "closed-inconclusive" terminal states

### Recommendation for subsequent specimens

The second and third calibration theses should be designed to exercise the failure paths:

- **Specimen 2** should include at least one gate failure that is corrected and re-submitted, to verify that the failure recording path works and that the correction produces a new record version rather than a silent edit.
- **Specimen 3** should be designed to end in "closed-contradicted" or "closed-inconclusive" to verify that the closure and evaluation paths work for non-confirming outcomes. A clean cycle that ends in contradiction is still clean if governance was followed; the calibration tracker measures discipline, not prediction accuracy.

---

**Document version:** 1.0
**Specimen type:** Calibration pressure test
**Capital authorized:** None
