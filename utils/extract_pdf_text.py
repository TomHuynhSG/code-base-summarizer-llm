import sys
import PyPDF2
import os

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("--- Error: No PDF file path provided. ---", file=sys.stderr)
        sys.exit(1)

    pdf_path = sys.argv[1]

    if not os.path.exists(pdf_path):
        print(f"--- Error: PDF file not found at {pdf_path} ---", file=sys.stderr)
        sys.exit(1)

    try:
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            text = ""
            if not reader.pages:
                print(f"--- No pages found in PDF {os.path.basename(pdf_path)}. ---", file=sys.stderr)
            for i, page in enumerate(reader.pages):
                try:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text
                    else:
                        # This case can happen if a page is an image or has no extractable text
                        text += f"[Page {i+1} contained no extractable text or was an image]\n"
                    text += "\n\n" # Add a separator between pages
                except Exception as e:
                    text += f"[Error extracting text from page {i+1}: {str(e)}]\n\n"
            if not text.strip():
                 print(f"--- No text extracted from PDF {os.path.basename(pdf_path)}. The PDF might be image-based or password-protected. ---", file=sys.stderr)
            sys.stdout.write(text) # Use sys.stdout.write for potentially large outputs
    except PyPDF2.errors.PdfReadError as e:
        print(f"--- Error reading PDF {os.path.basename(pdf_path)} (possibly encrypted or corrupted): {str(e)} ---", file=sys.stderr)
        sys.exit(1)
    except ImportError:
        print("--- Error: PyPDF2 is not installed. Run 'pip install PyPDF2' to enable PDF scanning. ---", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"--- Error processing PDF {os.path.basename(pdf_path)}: {str(e)} ---", file=sys.stderr)
        sys.exit(1)
