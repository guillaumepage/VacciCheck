#!/usr/bin/env python3
"""
Extraction JSON d'un carnet de vaccination PDF (format SI-PMI/Carnet Québec)
en utilisant pdfplumber.

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


COLUMN_KEYS = [
    "vaccin_administre_nom_commercial",
    "protege_contre_maladies",
    "date_age_administration",
    "quantite_voie_administration",
    "professionnel_lieu_administration",
]

HEADER_KEYWORDS = {
    "vaccin_administre_nom_commercial": ["vaccin", "administre"],
    "protege_contre_maladies": ["protege", "maladies"],
    "date_age_administration": ["date", "age"],
    "quantite_voie_administration": ["quantite", "voie"],
    "professionnel_lieu_administration": ["professionnel", "lieu"],
}

DATE_RE = re.compile(r"\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b")
FOOTER_RE = re.compile(r"^\s*Date\s*:\s*\d{4}", re.IGNORECASE)
PAGE_FOOTER_RE = re.compile(r"Page\s*\d+\s*de\s*\d+", re.IGNORECASE)


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def clean_cell(value: Any) -> str:
    if value is None:
        return ""
    text = str(value).replace("\x00", " ").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def is_header_row(row: list[str]) -> bool:
    joined = normalize(" ".join(row))
    hits = 0
    for kws in HEADER_KEYWORDS.values():
        if all(k in joined for k in kws):
            hits += 1
    return hits >= 2


def is_footer_row(row: list[str]) -> bool:
    joined = " ".join(row).strip()
    return bool(FOOTER_RE.search(joined) or PAGE_FOOTER_RE.search(joined))


def extract_patient_info(full_text: str) -> dict[str, str | None]:
    text = re.sub(r"[ \t]+", " ", full_text or "")

    nom = None
    m = re.search(r"\bNom\s*[:\-]?\s*([^\n]+)", text, flags=re.IGNORECASE)
    if m:
        candidate = clean_cell(m.group(1))
        candidate = re.split(
            r"\s*(?:Date de naissance|Naissance|DDN|NAM|Sexe)\b",
            candidate,
            maxsplit=1,
            flags=re.IGNORECASE,
        )[0]
        nom = candidate.strip(" :-") or None

    date_naissance = None
    dob_patterns = [
        r"\b(?:Date de naissance|Naissance|DDN)\s*[:\-]?\s*(\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
    ]
    for pat in dob_patterns:
        m = re.search(pat, text, flags=re.IGNORECASE)
        if m:
            date_naissance = m.group(1).strip()
            break

    return {"nom": nom, "date_naissance": date_naissance}


def find_header_table(page: Any) -> Any | None:
    """Trouve la table d'en-tête (5 colonnes 'Vaccin/Protège/Date/Quantité/Professionnel')."""
    for t in page.find_tables():
        rows = t.rows
        if not rows:
            continue
        first = rows[0]
        if len(first.cells) != 5:
            continue
        # Vérifie en lisant le texte de la première ligne
        cells_text = []
        for c in first.cells:
            if c is None:
                cells_text.append("")
                continue
            crop = page.crop(c)
            cells_text.append(crop.extract_text() or "")
        if is_header_row(cells_text):
            return t
    return None


def extract_page_rows(page: Any) -> list[list[str]]:
    """Retourne les lignes brutes d'une page sous forme de 5-colonnes."""
    header = find_header_table(page)
    if header is None:
        return []

    cells = header.rows[0].cells
    verticals = [cells[0][0]] + [c[2] for c in cells]
    top = header.bbox[3]
    bottom = page.height - 10
    if bottom <= top:
        return []

    crop = page.crop((header.bbox[0], top, header.bbox[2], bottom))
    settings = {
        "vertical_strategy": "explicit",
        "explicit_vertical_lines": verticals,
        "horizontal_strategy": "text",
        "snap_tolerance": 3,
        "text_y_tolerance": 2,
        "intersection_y_tolerance": 6,
    }
    tables = crop.extract_tables(settings) or []
    out: list[list[str]] = []
    for t in tables:
        for raw in t:
            row = [clean_cell(c) for c in (raw + [""] * 5)[:5]]
            out.append(row)
    return out


def group_entries(rows: list[tuple[int, list[str]]]) -> list[dict[str, Any]]:
    """Groupe les lignes en entrées-vaccin. Une nouvelle entrée commence
    quand on trouve une date YYYY/MM/DD dans la colonne 3 (date_age)."""
    entries: list[dict[str, Any]] = []
    buffer: list[tuple[int, list[str]]] = []

    def flush() -> None:
        if not buffer:
            return
        page_num = buffer[0][0]
        cols = ["", "", "", "", ""]
        for _, row in buffer:
            for i, val in enumerate(row):
                if not val:
                    continue
                cols[i] = f"{cols[i]}\n{val}".strip() if cols[i] else val
        if any(cols):
            entries.append(
                {
                    "page": page_num,
                    "vaccin_administre_nom_commercial": cols[0],
                    "protege_contre_maladies": cols[1],
                    "date_age_administration": cols[2],
                    "quantite_voie_administration": cols[3],
                    "professionnel_lieu_administration": cols[4],
                }
            )
        buffer.clear()

    blank_streak = 0
    has_date_in_buffer = False
    for page_num, row in rows:
        if is_header_row(row) or is_footer_row(row):
            continue
        non_empty = any(row)
        row_has_date = bool(DATE_RE.search(row[2] or ""))

        if not non_empty:
            blank_streak += 1
            # 2 lignes vides => fin d'entrée
            if blank_streak >= 2 and has_date_in_buffer:
                flush()
                has_date_in_buffer = False
                blank_streak = 0
            continue

        blank_streak = 0

        if row_has_date and has_date_in_buffer:
            # nouvelle entrée
            flush()
            has_date_in_buffer = False

        buffer.append((page_num, row))
        if row_has_date:
            has_date_in_buffer = True

    flush()
    return entries


def extract_pdf(pdf_path: Path, include_raw: bool = False) -> dict[str, Any]:
    with pdfplumber.open(pdf_path) as pdf:
        raw_pages = []
        all_rows: list[tuple[int, list[str]]] = []

        for idx, page in enumerate(pdf.pages, start=1):
            text = page.extract_text(x_tolerance=1, y_tolerance=3) or ""
            raw_pages.append({"page": idx, "text": text})
            for row in extract_page_rows(page):
                all_rows.append((idx, row))

        full_text = "\n".join(p["text"] for p in raw_pages)
        patient = extract_patient_info(full_text)
        vaccines = group_entries(all_rows)

        warnings: list[str] = []
        if not vaccines:
            warnings.append("Aucune entrée vaccin détectée.")
        if not patient["nom"]:
            warnings.append("Nom du patient non détecté.")
        if not patient["date_naissance"]:
            warnings.append("Date de naissance non détectée.")

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
            result["raw_rows"] = [{"page": p, "row": r} for p, r in all_rows]

        return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Extrait un carnet de vaccination PDF en JSON.")
    parser.add_argument("pdf", type=Path, help="Chemin du PDF à analyser")
    parser.add_argument("--pretty", action="store_true", help="Formate le JSON")
    parser.add_argument("--include-raw", action="store_true", help="Inclut texte/rows bruts")
    args = parser.parse_args()

    if not args.pdf.exists():
        print(f"PDF introuvable: {args.pdf}", file=sys.stderr)
        return 1

    result = extract_pdf(args.pdf, include_raw=args.include_raw)
    print(json.dumps(result, ensure_ascii=False, indent=2 if args.pretty else None))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
