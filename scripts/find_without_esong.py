import os
from pathlib import Path

def find_files_without_esong(folder_path):
    directory = Path(folder_path)
    missing_esong_files = []

    # Iterate through all files in the specified folder
    # If your files have a specific extension, you can change '*' to '*.tex'
    for filepath in directory.rglob('*'):
        if filepath.is_file():
            try:
                with open(filepath, 'r', encoding='utf-8') as file:
                    content = file.read()
                    # Look for the exact string \esong
                    if r'\esong' not in content:
                        missing_esong_files.append(filepath.name)
            except UnicodeDecodeError:
                # Skips non-text files like images if they are in the same folder
                pass 

    return missing_esong_files

# --- CONFIGURATION ---
# Set this to the relative or absolute path of your songs folder
folder_to_check = "songs" 

if __name__ == "__main__":
    print(f"Scanning folder '{folder_to_check}' for missing \\esong tags...\n")
    
    problem_files = find_files_without_esong(folder_to_check)

    if problem_files:
        print(f"Found {len(problem_files)} file(s) missing \\esong:")
        for name in problem_files:
            print(f"- {name}")
    else:
        print("All files contain \\esong!")