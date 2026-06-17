
import pandas as pd
import sys
import unicodedata


# --- Konfigurace ---
VSTUPNI_SOUBOR = 'seznamy_csv/javo26.csv'  # Můžeš změnit na .csv nebo jiný formát
VYSTUPNI_SOUBOR = 'seznamy_csv/soubor.txt'
# -------------------

def zpracuj_a_uloz(vstup, vystup):
    """
    Načte sloupec A z Excel/CSV souboru a uloží každé slovo 
    do textového souboru ve formátu \add{slovo.tex}.
    """
    try:
        print(f"Načítám data ze souboru: {vstup}...")
        
        # Podpora pro CSV i Excel soubory
        if vstup.lower().endswith('.csv'):
            # Načte první sloupec (index 0) z CSV
            df = pd.read_csv(vstup, usecols=[0], header=None)
        else:
            # Načte přímo sloupec 'A' z Excelu
            df = pd.read_excel(vstup, usecols="A", header=None)
        
        # Získání hodnot z prvního sloupce a zahození prázdných buněk (NaN)
        slova = df.iloc[:, 0].dropna().tolist()
        
        print(f"Nalezeno {len(slova)} platných záznamů. Zapisuji do {vystup}...")
        
        # Otevření výstupního souboru pro zápis (s podporou české diakritiky)
        with open(vystup, 'w', encoding='utf-8') as f:
            for polozka in slova:
                slovo = str(polozka).strip()
                
                if slovo:
                    # 1. Odstranění diakritiky
                    slovo_bez_dia = ''.join(c for c in unicodedata.normalize('NFD', slovo) if unicodedata.category(c) != 'Mn')
                    
                    # 2. Nahrazení mezer podtržítkem (split() si poradí i s vícenásobnými mezerami)
                    slovo_finalni = "_".join(slovo_bez_dia.split()).lower()
                    
                    zformatovany_radek = f"\\add{{{slovo_finalni}.tex}}\n"
                    f.write(zformatovany_radek)
                    
        print("Hotovo! Všechna slova byla úspěšně zpracována.")

    except FileNotFoundError:
        print(f"Chyba: Soubor '{vstup}' nebyl nalezen. Zkontroluj cestu.")
        sys.exit(1)
    except Exception as e:
        print(f"Nastala neočekávaná chyba: {e}")
        sys.exit(1)

if __name__ == "__main__":
    zpracuj_a_uloz(VSTUPNI_SOUBOR, VYSTUPNI_SOUBOR)