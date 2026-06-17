#!/usr/bin/env python3
"""
Extraction JSON d'un carnet de vaccination PDF avec pdfplumber.

Installation :
  python -m pip install pdfplumber

Utilisation :
  python scripts/extract_vaccination_pdf.py carnet.pdf --pretty > carnet.json
  python scripts/extract_vaccination_pdf.py carnet.pdf --include-raw --pretty
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any

try:
    import pdfplumber
except ImportError:  # pragma: no cover
    print(
        "Module manquant: pdfplumber. Installez-le avec: python -m pip install pdfplumber",
        file=sys.stderr,
    )
    raise SystemExit(2)


EXPECTED_COLUMNS = [
    "vaccin_administre_nom_commercial",
    "protege_contre_maladies",
    "date_age_administration",
    "quantite_voie_administration",
    "professionnel_lieu_administration",
]

HEADER_KEYWORDS = {
    "vaccin_administre_nom_commercial": ["vaccin administre", "nom commercial"],
    "protege_contre_maladies": ["protege", "maladies"],
    "date_age_administration": ["date", "age", "administration"],
    "quantite_voie_administration": ["quantite", "voie", "administration"],
    "professionnel_lieu_administration": ["professionnel", "lieu", "administration"],
}


def clean_cell(value: Any) -> str:
    """Nettoie une cellule extraite par pdfplumber."""
    if value is None:
        return ""
    text = str(value).replace("\x00", " ").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{2,}", "\n", text)
    return text.strip()


def normalize(text: str) -> str:
    """Normalise pour comparer les en-têtes malgré les accents / sauts de ligne."""
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower().replace("’", "'")
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def is_header_row(row: list[str]) -> bool:
    joined = normalize(" ".join(row))
    matches = 0
    for keywords in HEADER_KEYWORDS.values():
        if all(keyword in joined for keyword in keywords):
            matches += 1
    return matches >= 2


def looks_like_continuation(row: list[str]) -> bool:
    non_empty = [cell for cell in row if cell]
    return len(non_empty) == 1


def row_to_entry(row: list[str], page_number: int) -> dict[str, Any] | None:
    cells = (row + [""] * 5)[:5]
    if not any(cells):
        return None
    if is_header_row(cells):
        return None

    return {
        "page": page_number,
        "vaccin_administre_nom_commercial": cells[0],
        "protege_contre_maladies": cells[1],
        "date_age_administration": cells[2],
        "quantite_voie_administration": cells[3],
        "professionnel_lieu_administration": cells[4],
    }


def merge_continuation(previous: dict[str, Any], row: list[str]) -> None:
    """Ajoute une ligne de continuation à l'entrée précédente."""
    for key, value in zip(EXPECTED_COLUMNS, row):
        if not value:
            continue
        previous[key] = f"{previous[key]}\n{value}".strip() if previous[key] else value


def extract_patient_info(full_text: str) -> dict[str, str | None]:
    text = re.sub(r"[ \t]+", " ", full_text)

    name_patterns = [
        r"\bNom\s*[:\-]?\s*([^\n]+)",
        r"\bNom de famille et prénom\s*[:\-]?\s*([^\n]+)",
        r"\bPatient\s*[:\-]?\s*([^\n]+)",
    ]
    dob_patterns = [
        r"\bDate de naissance\s*[:\-]?\s*([0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}|[0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})",
        r"\bNaissance\s*[:\-]?\s*([0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}|[0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})",
        r"\bDDN\s*[:\-]?\s*([0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}|[0-9]{1,2}[-/][0-9]{1,2}[-/][0-9]{2,4})",
    ]

    nom = None
    for pattern in name_patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            candidate = clean_cell(match.group(1))
            candidate = re.split(r"\s{2,}| Date de naissance\b| Naissance\b| DDN\b", candidate, maxsplit=1, flags=re.IGNORECASE)[0]
            nom = candidate.strip(" :-") or None
            break

    date_naissance = None
    for pattern in dob_patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            date_naissance = clean_cell(match.group(1)).strip(" :-") or None
            break

    return {"nom": nom, "date_naissance": date_naissance}


def extract_vaccines_from_tables(pdf: Any) -> list[dict[str, Any]]:
    vaccines: list[dict[str, Any]] = []

    table_settings = {
        "vertical_strategy": "lines",
        "horizontal_strategy": "lines",
        "snap_tolerance": 3,
        "join_tolerance": 3,
        "intersection_tolerance": 5,
        "text_x_tolerance": 2,
        "text_y_tolerance": 3,
    }

    for page_index, page in enumerate(pdf.pages, start=1):
        tables = page.extract_tables(table_settings) or []

        for table in tables:
            for raw_row in table:
                row = [clean_cell(cell) for cell in raw_row]
                if not any(row):
                    continue

                if len(row) != 5 and len(row) > 5:
                    row = row[:4] + ["\n".join(row[4:])]

                row = (row + [""] * 5)[:5]

                if is_header_row(row):
                    continue

                if vaccines and looks_like_continuation(row):
                    merge_continuation(vaccines[-1], row)
                    continue

                entry = row_to_entry(row, page_index)
                if entry:
                    vaccines.append(entry)

    return vaccines


def extract_vaccines_from_text_pages(raw_pages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Secours si le PDF n'a pas de vraies lignes de tableau.
    Cette méthode garde les lignes détectées sans tenter d'inventer les colonnes.
    """
    vaccines: list[dict[str, Any]] = []
    date_pattern = re.compile(r"\b(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b")

    for page in raw_pages:
        for line in page["text"].splitlines():
            line = clean_cell(line)
            if not line or is_header_row([line]):
                continue
            if not date_pattern.search(line):
                continue
            vaccines.append(
                {
                    "page": page["page"],
                    "vaccin_administre_nom_commercial": line,
                    "protege_contre_maladies": "",
                    "date_age_administration": "",
                    "quantite_voie_administration": "",
                    "professionnel_lieu_administration": "",
                    "parse_note": "fallback_text_line",
                }
            )

    return vaccines


def extract_pdf(pdf_path: Path, include_raw: bool = False) -> dict[str, Any]:
    with pdfplumber.open(pdf_path) as pdf:
        raw_pages = []
        for page_index, page in enumerate(pdf.pages, start=1):
            raw_pages.append(
                {
                    "page": page_index,
                    "text": page.extract_text(x_tolerance=1, y_tolerance=3) or "",
                }
            )

        full_text = "\n".join(page["text"] for page in raw_pages)
        patient = extract_patient_info(full_text)
        vaccines = extract_vaccines_from_tables(pdf)

        warnings: list[str] = []
        if not vaccines:
            warnings.append("Aucun tableau exploitable détecté; extraction de secours par lignes de texte utilisée.")
            vaccines = extract_vaccines_from_text_pages(raw_pages)
        if not patient["nom"]:
            warnings.append("Nom du patient non détecté automatiquement.")
        if not patient["date_naissance"]:
            warnings.append("Date de naissance non détectée automatiquement.")

        result: dict[str, Any] = {
            "source_file": pdf_path.name,
            "page_count": len(pdf.pages),
            "patient": patient,
            "vaccins": vaccines,
            "counts": {"vaccins": len(vaccines)},
            "warnings": warnings,
        }

        if include_raw:
            result["raw_pages"] = raw_pages

        return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Extrait un carnet de vaccination PDF en JSON.")
    parser.add_argument("pdf", type=Path, help="Chemin du PDF à analyser")
    parser.add_argument("--pretty", action="store_true", help="Formate le JSON avec indentation")
    parser.add_argument("--include-raw", action="store_true", help="Inclut le texte brut par page dans le JSON")
    args = parser.parse_args()

    if not args.pdf.exists():
        print(f"PDF introuvable: {args.pdf}", file=sys.stderr)
        return 1

    result = extract_pdf(args.pdf, include_raw=args.include_raw)
    print(json.dumps(result, ensure_ascii=False, indent=2 if args.pretty else None))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())