import sys
from pypdf import PdfReader

def extract_text(pdf_path, out_file):
    try:
        reader = PdfReader(pdf_path)
        text = ""
        for page in reader.pages:
            t = page.extract_text()
            if t:
                text += t + "\n"
        out_file.write(f"--- START FORMAT {pdf_path} ---\n")
        out_file.write(text[:4000] + "\n...(TRUNCATED)\n" if len(text) > 4000 else text + "\n")
        out_file.write(f"--- END FORMAT {pdf_path} ---\n\n")
    except Exception as e:
        out_file.write(f"Error reading {pdf_path}: {e}\n")

if __name__ == "__main__":
    with open("outputs_utf8.txt", "w", encoding="utf-8") as f:
        for arg in sys.argv[1:]:
            extract_text(arg, f)
