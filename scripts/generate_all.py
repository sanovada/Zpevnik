import os

def generuj_seznam_pisni(slozka_pisin='songs', vystupni_soubor='all_songs.txt'):
    """
    Projde zadanou složku, najde všechny soubory s příponou .tex
    a vytvoří textový soubor ve formátu \add{jmeno_pisne.tex}.
    """
    # Kontrola, zda složka vůbec existuje
    if not os.path.exists(slozka_pisin):
        print(f"Chyba: Složka '{slozka_pisin}' neexistuje!")
        return

    # Načtení všech .tex souborů ze složky
    soubory = [f for f in os.listdir(slozka_pisin) if f.endswith('.tex')]
    
    # Seřazení abecedně pro zachování pořádku ve zpěvníku
    soubory.sort()

    # Zápis do výstupního souboru
    with open(vystupni_soubor, 'w', encoding='utf-8') as f:
        for soubor in soubory:
            # Zápis ve formátu \add{jmeno_souboru.tex}
            f.write(f"\\add{{{soubor}}}\n")

    print(f"Úspěšně vytvořeno! Soubor '{vystupni_soubor}' obsahuje {len(soubory)} písniček.")

if __name__ == '__main__':
    # Předpokládáme složku s názvem 'songs'
    generuj_seznam_pisni('songs', 'all_songs.txt')