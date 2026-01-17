# Classification Methods in the Multi-Metric Classifier

This document provides an extensive explanation of each classification method used in the N-Dimensional Cellular Automata Engine.

## Table of Contents

1. [Wolfram's Four-Class Classification](#1-wolframs-four-class-classification-1984)
2. [Shannon Entropy Analysis](#2-shannon-entropy-analysis-1948)
3. [State Hash Cycle Detection](#3-state-hash-cycle-detection-fnv-1a--floyd-inspired)
4. [Population Trend Analysis](#4-population-trend-analysis)
5. [Entropy Trend Analysis](#5-entropy-trend-analysis)
6. [Langton's Edge of Chaos](#6-langtons-edge-of-chaos-1990)
7. [Hamming Distance](#7-hamming-distance-ruivo-et-al-2024)
8. [Classification Decision Tree](#classification-decision-tree)
9. [Confidence Scores](#confidence-scores)

---

## 1. Wolfram's Four-Class Classification (1984)

Stephen Wolfram proposed that all cellular automata fall into four behavioral classes:

```
Class 1: Homogeneous          Class 2: Periodic           Class 3: Chaotic            Class 4: Complex
┌─────────────────┐           ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│█████████████████│           │░█░█░█░█░█░█░█░█│         │█ ░█  ░ █░ █ ░ █│         │    ░█░          │
│█████████████████│           │█░█░█░█░█░█░█░█░│         │ ░  █░█ ░░█  █░░│         │   ░███░         │
│█████████████████│           │░█░█░█░█░█░█░█░█│         │█░██░ ░█ ██░█░ █│         │  ░█   █░        │
│█████████████████│           │█░█░█░█░█░█░█░█░│         │░█ ░█░░██░░ ██░░│         │   ░███░         │
│█████████████████│           │░█░█░█░█░█░█░█░█│         │░░██ █░█ ░█░░█░█│         │    ░█░          │
└─────────────────┘           └─────────────────┘         └─────────────────┘         └─────────────────┘
All cells same state          Fixed patterns or           Random-looking              Localized structures
(entropy = 0)                 oscillations                patterns                    ("gliders")
```

### Class Descriptions

| Class | Name | Behavior | Example |
|-------|------|----------|---------|
| **Class 1** | Homogeneous | All cells converge to same state | Rule 0, Rule 255 |
| **Class 2** | Periodic | Stable patterns or oscillators | Rule 4, Rule 108 |
| **Class 3** | Chaotic | Pseudo-random, aperiodic | Rule 30, Rule 45 |
| **Class 4** | Complex | Localized structures, long transients | Rule 110, Game of Life |

### Implementation

Detected in `classifier.ts:274-281` via `entropy === 0` for Class 1.

### References

- Wolfram, S. (1984). "Universality and Complexity in Cellular Automata". *Physica D*, 10(1-2), 1-35. DOI: [10.1016/0167-2789(84)90245-8](https://doi.org/10.1016/0167-2789(84)90245-8)
- Wolfram, S. (2002). "A New Kind of Science". Wolfram Media. Chapter 6, pp. 231-249.

---

## 2. Shannon Entropy Analysis (1948)

Measures disorder in the grid using Claude Shannon's information entropy formula:

```
H = -p × log₂(p) - (1-p) × log₂(1-p)

where p = population / total_cells
```

### Entropy Curve

```
    1.0 ┤              ╭────╮
        │            ╭─╯    ╰─╮
H(p)    │          ╭─╯        ╰─╮
    0.5 ┤        ╭─╯            ╰─╮
        │      ╭─╯                ╰─╮
        │    ╭─╯                    ╰─╮
    0.0 ┼──╯────────────────────────╰──
        0    0.25    0.5    0.75    1.0
                     p (density)
```

### Interpretation

| Entropy Value | Meaning | Wolfram Class |
|---------------|---------|---------------|
| H ≈ 0 | Uniform grid (all dead or all alive) | Class 1 |
| H ≈ 1 | Maximum disorder (50% alive) | Potentially Class 3 |
| H stable mid-range | Equilibrium state | May indicate Class 4 |

### Implementation

Located in `grid.ts:237-254` - `computeSpatialEntropy()` function.

### References

- Shannon, C.E. (1948). "A Mathematical Theory of Communication". *Bell System Technical Journal*, 27(3), 379-423. DOI: [10.1002/j.1538-7305.1948.tb01338.x](https://doi.org/10.1002/j.1538-7305.1948.tb01338.x)
- Baetens, J.M. & De Baets, B. (2021). "Entropy-Based Classification of Elementary Cellular Automata". *Entropy*, 23(2), 209. DOI: [10.3390/e23020209](https://doi.org/10.3390/e23020209)

---

## 3. State Hash Cycle Detection (FNV-1a + Floyd-inspired)

Detects true periodicity by hashing entire grid states and finding collisions.

### Algorithm

```
Step 1: Hash each state using FNV-1a
┌────────┬────────┬────────┬────────┬────────┐
│State 0 │State 1 │State 2 │State 3 │State 4 │...
│h=A3B2  │h=F721  │h=8C4E  │h=A3B2  │h=F721  │
└────────┴────────┴───│────┴────────┴────────┘
                      │
Step 2: Detect hash collision
        h(0) = h(3) → Period = 3
```

### Analysis Window

The algorithm only analyzes the final 50% of the simulation to ignore transient behavior:

```
┌──────────────────────────────────────────────────┐
│ Transient ██████████████│ Analysis Window ████████│
│  (ignored)              │ (cycle detection)       │
└─────────────────────────┴────────────────────────┘
           50%                        50%
```

### FNV-1a Hash Parameters

- **Offset basis**: 2166136261 (32-bit)
- **Prime**: 16777619

### Implementation

- Hash function: `grid.ts:283-293` - `computeStateHash()`
- Cycle detection: `classifier.ts:70-115` - `detectCycle()`

### References

- Knuth, D.E. (1997). "The Art of Computer Programming, Vol. 2". Section 3.1 (Floyd's algorithm attribution).
- Fowler, Noll, Vo & Eastlake (2019). "The FNV Non-Cryptographic Hash Algorithm". IETF draft-eastlake-fnv-17.

---

## 4. Population Trend Analysis

Tracks population dynamics over time to classify growth patterns.

### Trend Patterns

```
Explosive Growth:                    Stable:                        Oscillating:
Population                           Population                      Population
   │                    ╭──          │                               │   ╭─╮ ╭─╮ ╭─╮
   │                 ╭──╯            │  ──────────────────           │  ╭╯ ╰─╯ ╰─╯ ╰─╮
   │              ╭──╯               │                               │ ╭╯            ╰╮
   │           ╭──╯                  │                               │╭╯              ╰
   │        ╭──╯                     │                               ├╯
   │     ╭──╯                        │                               │
   └──────────────────────►          └──────────────────────►        └──────────────────────►
                Time                            Time                            Time
```

### Classification Criteria (Final 30% of Simulation)

| Trend | Criteria |
|-------|----------|
| **Growing** | `trend_strength > 0.6` AND more increases than decreases |
| **Shrinking** | `trend_strength > 0.6` AND more decreases than increases |
| **Oscillating** | `coefficient_of_variation > 0.3` |
| **Stable** | Default (none of the above) |

### Metrics Computed

- **Mean**: Average population in analysis window
- **Variance**: Spread of population values
- **Coefficient of Variation**: `stdDev / mean` (normalized variability)
- **Trend Strength**: `|increases - decreases| / total_changes`

### Implementation

Located in `classifier.ts:120-164` - `analyzePopulationTrend()` function.

---

## 5. Entropy Trend Analysis

Tracks how spatial entropy evolves over time, based on Baetens & De Baets (2021).

### Trend Patterns

```
Increasing Entropy:     Decreasing Entropy:    Stable Entropy:      Fluctuating Entropy:
(moving toward chaos)   (crystallizing)        (equilibrium)        (Class 3 chaotic)
Entropy                 Entropy                Entropy              Entropy
   │          ╭───       │───╮                  │  ──────────        │  ╭╮  ╭╮╭╮
   │       ╭──╯          │   ╰──╮               │                    │ ╭╯╰╮╭╯╰╯╰╮
   │    ╭──╯             │      ╰──╮            │                    │╭╯  ╰╯    ╰╮
   │ ╭──╯                │         ╰──╮         │                    ├╯          ╰
   ├─╯                   │            ╰─        │                    │
   └────────────►        └──────────────►       └────────────►       └────────────►
        Time                   Time                  Time                 Time
```

### Classification Logic

| Trend | Criteria |
|-------|----------|
| **Fluctuating** | `stdDev > 0.1` (high variance indicates chaos) |
| **Increasing** | `ratio(increases) > 0.7` |
| **Decreasing** | `ratio(increases) < 0.3` |
| **Stable** | Default (none of the above) |

### Implementation

Located in `classifier.ts:169-208` - `analyzeEntropyTrend()` function.

### References

- Baetens, J.M. & De Baets, B. (2021). DOI: [10.3390/e23020209](https://doi.org/10.3390/e23020209)

---

## 6. Langton's Edge of Chaos (1990)

Chris Langton discovered that Class 4 (complex) behavior emerges at the boundary between order and chaos, controlled by the λ (lambda) parameter.

### Lambda Parameter Spectrum

```
     0                                                      1
     ├──────────────┬──────────────┬──────────────┬────────┤
     │   Class 1    │   Class 2    │   Class 4    │ Class 3│
     │ (homogeneous)│  (periodic)  │  (complex)   │(chaotic)│
     │  λ ≈ 0       │              │ "edge of     │ λ → 1  │
     │              │              │   chaos"     │        │
     └──────────────┴──────────────┴──────────────┴────────┘
                                   ↑
                          Computational universality
                          (Turing-complete behavior)
```

### Significance

- **Class 4** systems at the edge of chaos can support universal computation
- Rule 110 and Conway's Game of Life are proven Turing-complete
- This region exhibits "long transients" before settling

### Detection Heuristic (Conservative)

Class 4 is detected when ALL conditions are met:
- Entropy trend is stable
- Entropy in mid-range: `0.3 < H < 0.8`
- No cycle detected
- Long simulation: `≥ 50 steps`

**Note**: Class 4 detection has low confidence (0.5) because it's the hardest class to identify automatically.

### Implementation

Located in `classifier.ts:346-360`.

### References

- Langton, C.G. (1990). "Computation at the Edge of Chaos". *Physica D*, 42(1-3), 12-37. DOI: [10.1016/0167-2789(90)90064-V](https://doi.org/10.1016/0167-2789(90)90064-V)
- Li, W. & Packard, N. (1990). "The Structure of the Elementary Cellular Automata Rule Space". *Complex Systems*, 4(3), 281-297.

---

## 7. Hamming Distance (Ruivo et al., 2024)

Measures sensitivity to initial conditions by counting differing cells between two grid states.

### Visualization

```
Grid 1:          Grid 2:          Difference:
░█░░█░           ░█░░█░           ░░░░░░
█░░█░░    vs     █░░█░█      →    ░░░░░█   Hamming = 2
░░█░░░           ░░█░█░           ░░░░█░
```

### Time Evolution Patterns

```
Class 2 (periodic):     Class 3 (chaotic):     Class 4 (complex):
Hamming                 Hamming                 Hamming
   │                       │            ╭───       │        ╭──╮
   │ ──────────            │         ╭──╯          │     ╭──╯  ╰──╮
   │                       │      ╭──╯             │  ╭──╯        ╰
   │                       │   ╭──╯                │╭─╯
   │                       │╭──╯                   ├╯
   └────────────►          └────────────►          └────────────►
   Converges to 0          Grows exponentially     Bounded, variable
```

### Interpretation

| Behavior | Hamming Distance Evolution |
|----------|---------------------------|
| **Class 2** | Converges to 0 (identical trajectories) |
| **Class 3** | Grows exponentially (butterfly effect) |
| **Class 4** | Bounded but variable (sensitive but not chaotic) |

### Implementation

Located in `grid.ts:302-311` - `computeHammingDistance()` function.

### References

- Ruivo, E.L.P., Balbi, P.P., & Monetti, R. (2024). "Classification of Cellular Automata based on the Hamming distance". arXiv:2407.06175. DOI: [10.48550/arXiv.2407.06175](https://doi.org/10.48550/arXiv.2407.06175)

---

## Classification Decision Tree

The multi-metric classifier follows this decision tree:

```
                          ┌─────────────────┐
                          │  metricsHistory │
                          └────────┬────────┘
                                   │
                          ┌────────▼────────┐
                          │ population = 0? │
                          └────────┬────────┘
                            yes/   │   \no
                           ┌───────▼───────┐
                           │   EXTINCT     │
                           └───────────────┘
                                   │no
                          ┌────────▼────────┐
                          │  entropy = 0?   │
                          └────────┬────────┘
                            yes/   │   \no
                           ┌───────▼───────┐
                           │ CLASS 1       │
                           │ (homogeneous) │
                           └───────────────┘
                                   │no
                          ┌────────▼────────┐
                          │ cycle detected? │
                          └────────┬────────┘
                            yes/   │   \no
                    ┌──────────────┴──────────────┐
                    │                             │
            ┌───────▼───────┐             ┌───────▼───────┐
            │  period = 1?  │             │ entropy       │
            └───────┬───────┘             │ fluctuating?  │
             yes/   │   \no               └───────┬───────┘
        ┌───────────┴───────────┐          yes/   │   \no
  ┌─────▼─────┐          ┌──────▼──────┐ ┌───────▼───────┐
  │ CLASS 2   │          │  CLASS 2    │ │   CLASS 3     │
  │ (stable)  │          │ (periodic)  │ │   (chaotic)   │
  └───────────┘          └─────────────┘ └───────────────┘
                                                │no
                                        ┌───────▼───────┐
                                        │ pop growing?  │
                                        └───────┬───────┘
                                         yes/   │   \no
                                   ┌────────────┴────────────┐
                            ┌──────▼──────┐          ┌───────▼───────┐
                            │  EXPLOSIVE  │          │ edge of chaos?│
                            │  (growth)   │          └───────┬───────┘
                            └─────────────┘           yes/   │   \no
                                              ┌──────────────┴──────────────┐
                                        ┌─────▼─────┐              ┌────────▼────────┐
                                        │  CLASS 4  │              │ DEFAULT: CLASS 2│
                                        │ (complex) │              │    (stable)     │
                                        └───────────┘              └─────────────────┘
```

---

## Confidence Scores

Each classification includes a confidence score reflecting certainty:

| Classification | Confidence | Rationale |
|---------------|------------|-----------|
| **Extinct** | 1.0 | Deterministic check (population = 0) |
| **Class 1** (homogeneous) | 0.95 | Deterministic check (entropy = 0) |
| **Class 2** (stable, period-1) | 0.95 | High confidence (exact state hash match) |
| **Class 2** (periodic, period > 1) | 0.90 | High confidence (verified cycle in hash sequence) |
| **Explosive** | 0.80 | Based on growth ratio threshold |
| **Class 3** (chaotic) | 0.75 | Entropy variance heuristic |
| **Class 4** (complex) | 0.50 | Low confidence (hardest class to detect automatically) |
| **Default** (stable) | 0.70 | Fallback when no other pattern matches |

### Why Class 4 Has Low Confidence

Class 4 (complex/edge of chaos) is notoriously difficult to detect because:

1. **No simple metric**: Unlike Class 1-3, there's no single measurable property
2. **Long transients**: May require very long simulations to distinguish from Class 3
3. **Localized structures**: Gliders and other structures are hard to detect automatically
4. **False positives**: Some Class 3 systems can appear Class 4-like for limited time

For definitive Class 4 classification, manual inspection or specialized glider-detection algorithms are recommended.

---

## Summary Table

| Method | What It Measures | Primary Use | Reference |
|--------|-----------------|-------------|-----------|
| Wolfram Classes | Qualitative behavior type | Overall classification | Wolfram (1984) |
| Shannon Entropy | Disorder/randomness | Class 1 detection, chaos indicator | Shannon (1948) |
| State Hash | Exact state recurrence | Cycle/period detection | Knuth (1997) |
| Population Trend | Growth dynamics | Explosive detection | - |
| Entropy Trend | Order evolution | Class 3 detection | Baetens (2021) |
| Lambda Parameter | Phase transition | Class 4 (edge of chaos) | Langton (1990) |
| Hamming Distance | Sensitivity | Chaos vs. stability | Ruivo (2024) |

---

## See Also

- [CITATIONS.md](../CITATIONS.md) - Full academic references with BibTeX entries
- [classifier.ts](../src/classifier.ts) - Implementation source code
- [grid.ts](../src/grid.ts) - Entropy and hash implementations
