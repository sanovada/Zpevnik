# Zpěvník 🎵

Projekt sbírky písní v LaTeX formátu.

## Struktura projektu

### Hlavní soubory
- **zpevnik_elektronicky.tex** - Elektronická verze zpěvníku (všechny písně)
- **zpevnik_nastroj.tex** - Verze zpěvníku zaměřená na rychlé čtení jedné písničky
- **zpevnik_papirovy.tex** - Verze zpěvníku optimalizovaná pro tisk
- **zpevnik_kluci.tex**, **zpevnik_lu.tex** - Zpěvníky pro konkrétní akce
- **guitar.sty** - Vlastní LaTeX styl pro formátování

### Složky
- **songs/** - Jednotlivé písně v .tex formátu (jen písně, nic jiného)
- **seznamy/** - Seznamy písní pro jednotlivé zpěvníky (`seznam_*.txt`, řádky `\add{pisen.tex}`)
- **images/** - Obrázky k písním a doplňující materiál
- **nové_písničky/** - Nové písně po sdílení všem skautům na Overleaf
- **scripts/** - Pomocné skripty (spouštět z kořene repozitáře)
- **docs/** - Návody (jak psát novou písničku, návod pro dobrovolníky, tisk A5 na A4, akordy)

## Seznamy písní
Zpěvník načte seznam ze složky `seznamy/` příkazem `\input{seznamy/seznam_xyz.txt}`.
- `python scripts/generate_all.py` - vytvoří `seznamy/seznam_vsechny.txt` ze všech písní
- `python scripts/seznam_z_csv.py` - převede seznam názvů z CSV na `\add{...}` řádky

## Použití
1. Upravte obsah v jednotlivých .tex souborech
2. Kompilujte LaTeX dokumenty do PDF
3. Nové písně přidávejte do složky `songs/` a aktualizujte příslušné seznamy
