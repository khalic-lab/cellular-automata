# Academic Citations

This library's classification methodology is based on peer-reviewed academic research. If you use this library in academic work, please cite the relevant papers below.

## Primary References

### Wolfram's Classification Framework

**[1]** Wolfram, S. (1984). **"Universality and Complexity in Cellular Automata"**
*Physica D: Nonlinear Phenomena*, 10(1-2), 1-35.

- DOI: [10.1016/0167-2789(84)90245-8](https://doi.org/10.1016/0167-2789(84)90245-8)
- Introduces the four-class classification system for cellular automata behavior

**[2]** Wolfram, S. (2002). **"A New Kind of Science"**
Wolfram Media, Inc.

- ISBN: 1-57955-008-8
- URL: https://www.wolframscience.com/nks/
- Chapter 6, pp. 231-249: Detailed description of four classes of behavior

### Entropy-Based Classification

**[3]** Baetens, J.M. & De Baets, B. (2021). **"Entropy-Based Classification of Elementary Cellular Automata under Asynchronous Updating: An Experimental Study"**
*Entropy*, 23(2), 209. MDPI.

- DOI: [10.3390/e23020209](https://doi.org/10.3390/e23020209)
- PMID: [33567757](https://pubmed.ncbi.nlm.nih.gov/33567757/)
- PMC: [PMC7914717](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7914717/)
- Provides entropy-based metrics for CA classification

### Hamming Distance Classification

**[4]** Ruivo, E.L.P., Balbi, P.P., & Monetti, R. (2024). **"Classification of Cellular Automata based on the Hamming distance"**
*arXiv preprint* arXiv:2407.06175.

- DOI: [10.48550/arXiv.2407.06175](https://doi.org/10.48550/arXiv.2407.06175)
- arXiv: [2407.06175](https://arxiv.org/abs/2407.06175)
- Describes Hamming distance method for objective classification

### Automatic Classification

**[5]** Wuensche, A. (1999). **"Classifying Cellular Automata Automatically: Finding Gliders, Filtering, and Relating Space-Time Patterns, Attractor Basins, and the Z Parameter"**
*Complexity*, 4(3), 47-66.

- DOI: [10.1002/(SICI)1099-0526(199901/02)4:3<47::AID-CPLX9>3.0.CO;2-V](https://doi.org/10.1002/(SICI)1099-0526(199901/02)4:3%3C47::AID-CPLX9%3E3.0.CO;2-V)
- Santa Fe Institute Working Paper
- Automatic classification using input-entropy variance

## Foundational Works

### Origins of Cellular Automata

**[6]** Von Neumann, J. (1966). **"Theory of Self-Reproducing Automata"**
Edited by Arthur W. Burks. University of Illinois Press.

- ISBN: 978-0-252-72733-7
- URL: https://archive.org/details/theoryofselfrepr00vonn_0
- Foundational work on cellular automata and self-replication
- Introduced the von Neumann neighborhood (orthogonal adjacency)

**[7]** Gardner, M. (1970). **"The Fantastic Combinations of John Conway's New Solitaire Game 'Life'"**
*Scientific American*, 223(4), 120-123.

- First public description of Conway's Game of Life
- Sparked widespread interest in cellular automata research

### Edge of Chaos and Lambda Parameter

**[8]** Langton, C.G. (1990). **"Computation at the Edge of Chaos: Phase Transitions and Emergent Computation"**
*Physica D: Nonlinear Phenomena*, 42(1-3), 12-37.

- DOI: [10.1016/0167-2789(90)90064-V](https://doi.org/10.1016/0167-2789(90)90064-V)
- Introduces the λ (lambda) parameter for CA classification
- Demonstrates phase transitions between ordered and chaotic behavior
- Foundational work on "edge of chaos" hypothesis

**[9]** Li, W. & Packard, N. (1990). **"The Structure of the Elementary Cellular Automata Rule Space"**
*Complex Systems*, 4(3), 281-297.

- URL: https://www.complex-systems.com/abstracts/v04_i03_a03/
- PDF: https://www.complex-systems.com/pdf/04-3-3.pdf
- Systematic analysis of rule space structure
- Complements Langton's lambda parameter work

## Additional References

### General Cellular Automata Theory

**[10]** Ilachinski, A. (2001). **"Cellular Automata: A Discrete Universe"**
World Scientific Publishing.

- ISBN: 978-981-238-183-5
- DOI: [10.1142/4702](https://doi.org/10.1142/4702)
- Comprehensive textbook on cellular automata theory

### N-Dimensional Extensions

**[11]** Bays, C. (1987). **"Candidates for the Game of Life in Three Dimensions"**
*Complex Systems*, 1, 373-400.

- URL: https://www.complex-systems.com/abstracts/v01_i03_a01/
- Extension of Conway's Game of Life to higher dimensions

### Algorithms and Information Theory

**[12]** Shannon, C.E. (1948). **"A Mathematical Theory of Communication"**
*Bell System Technical Journal*, 27(3), 379-423.

- DOI: [10.1002/j.1538-7305.1948.tb01338.x](https://doi.org/10.1002/j.1538-7305.1948.tb01338.x)
- Foundation of information theory and entropy measures
- Spatial entropy calculations in this library are based on Shannon entropy

**[13]** Knuth, D.E. (1997). **"The Art of Computer Programming, Volume 2: Seminumerical Algorithms"**
3rd Edition. Addison-Wesley Professional.

- ISBN: 978-0-201-89684-8
- Section 3.1: Attributes Floyd's cycle detection algorithm
- Foundation for cycle/period detection in this library

**[14]** Fowler, G., Noll, L.C., Vo, K.-P., & Eastlake, D. (2019). **"The FNV Non-Cryptographic Hash Algorithm"**
*IETF Internet-Draft* draft-eastlake-fnv-17.

- URL: https://datatracker.ietf.org/doc/html/draft-eastlake-fnv-17
- FNV-1a hash algorithm used for state hashing in cycle detection

## BibTeX Entries

```bibtex
@article{wolfram1984universality,
  title={Universality and complexity in cellular automata},
  author={Wolfram, Stephen},
  journal={Physica D: Nonlinear Phenomena},
  volume={10},
  number={1-2},
  pages={1--35},
  year={1984},
  publisher={Elsevier},
  doi={10.1016/0167-2789(84)90245-8}
}

@book{wolfram2002new,
  title={A New Kind of Science},
  author={Wolfram, Stephen},
  year={2002},
  publisher={Wolfram Media},
  isbn={1-57955-008-8},
  url={https://www.wolframscience.com/nks/}
}

@article{baetens2021entropy,
  title={Entropy-Based Classification of Elementary Cellular Automata under Asynchronous Updating: An Experimental Study},
  author={Baetens, Jan M and De Baets, Bernard},
  journal={Entropy},
  volume={23},
  number={2},
  pages={209},
  year={2021},
  publisher={MDPI},
  doi={10.3390/e23020209}
}

@article{ruivo2024classification,
  title={Classification of Cellular Automata based on the Hamming distance},
  author={Ruivo, Eurico LP and Balbi, Pedro Paulo and Monetti, Roberto},
  journal={arXiv preprint arXiv:2407.06175},
  year={2024},
  doi={10.48550/arXiv.2407.06175}
}

@article{wuensche1999classifying,
  title={Classifying cellular automata automatically: Finding gliders, filtering, and relating space-time patterns, attractor basins, and the Z parameter},
  author={Wuensche, Andrew},
  journal={Complexity},
  volume={4},
  number={3},
  pages={47--66},
  year={1999},
  doi={10.1002/(SICI)1099-0526(199901/02)4:3<47::AID-CPLX9>3.0.CO;2-V}
}

@book{vonneumann1966theory,
  title={Theory of Self-Reproducing Automata},
  author={Von Neumann, John},
  editor={Burks, Arthur W.},
  year={1966},
  publisher={University of Illinois Press},
  address={Urbana, IL},
  isbn={978-0-252-72733-7}
}

@article{gardner1970life,
  title={The fantastic combinations of {John Conway}'s new solitaire game ``life''},
  author={Gardner, Martin},
  journal={Scientific American},
  volume={223},
  number={4},
  pages={120--123},
  year={1970}
}

@article{langton1990computation,
  title={Computation at the edge of chaos: Phase transitions and emergent computation},
  author={Langton, Chris G.},
  journal={Physica D: Nonlinear Phenomena},
  volume={42},
  number={1-3},
  pages={12--37},
  year={1990},
  publisher={Elsevier},
  doi={10.1016/0167-2789(90)90064-V}
}

@article{li1990structure,
  title={The structure of the elementary cellular automata rule space},
  author={Li, Wentian and Packard, Norman},
  journal={Complex Systems},
  volume={4},
  number={3},
  pages={281--297},
  year={1990},
  url={https://www.complex-systems.com/abstracts/v04_i03_a03/}
}

@article{shannon1948mathematical,
  title={A mathematical theory of communication},
  author={Shannon, Claude E.},
  journal={Bell System Technical Journal},
  volume={27},
  number={3},
  pages={379--423},
  year={1948},
  doi={10.1002/j.1538-7305.1948.tb01338.x}
}

@book{knuth1997art,
  title={The Art of Computer Programming, Volume 2: Seminumerical Algorithms},
  author={Knuth, Donald E.},
  edition={3},
  year={1997},
  publisher={Addison-Wesley Professional},
  isbn={978-0-201-89684-8}
}

@techreport{fnv2019,
  title={The {FNV} Non-Cryptographic Hash Algorithm},
  author={Fowler, Glenn and Noll, Landon Curt and Vo, Kiem-Phong and Eastlake, Donald},
  year={2019},
  institution={IETF},
  type={Internet-Draft},
  number={draft-eastlake-fnv-17},
  url={https://datatracker.ietf.org/doc/html/draft-eastlake-fnv-17}
}
```

## How to Cite This Library

If you use this library in your research, please cite it as:

```bibtex
@software{nd_cellular_automata,
  title={N-Dimensional Cellular Automata Engine},
  author={[Your Name]},
  year={2024},
  url={[Repository URL]},
  note={TypeScript library implementing multi-metric classification based on Wolfram (1984), Baetens \& De Baets (2021), and Ruivo et al. (2024)}
}
```
