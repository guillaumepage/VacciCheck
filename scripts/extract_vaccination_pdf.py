#!/usr/bin/env python3
"""
Extraction JSON d'un carnet de vaccination PDF (format Registre Québec)
en utilisant pdfplumber + bucketing manuel par colonne.

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
from collections import defaultdict
from pathlib import Path
from typing import Any

try:
    import pdfplumber
except ImportError:  # pragma: no cover
    print("Module manquant: pdfplumber. Installez-le avec: python -m pip install pdfplumber", file=sys.stderr)
    raise SystemExit(2)


HEADER_KEYWORDS = {
    0: ["vaccin", "administre"],
    1: ["protege", "maladies"],
    2: ["date", "age"],
    3: ["quantite", "voie"],
    4: ["professionnel", "lieu"],
}
DATE_RE = re.compile(r"\b(\d{4}[/-]\d{1,2}[/-]\d{1,2})\b")


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def find_header_table(page: Any) -> Any | None:
    """Trouve la table d'en-tête à 5 colonnes."""
    for t in page.find_tables():
        if not t.rows or len(t.rows[0].cells) != 5:
            continue
        cells_text = []
        for c in t.rows[0].cells:
            if c is None:
                cells_text.append("")
                continue
            cells_text.append(page.crop(c).extract_text() or "")
        joined = normalize(" ".join(cells_text))
        hits = sum(1 for kws in HEADER_KEYWORDS.values() if all(k in joined for k in kws))
        if hits >= 3:
            return t
    return None


def page_verticals(page: Any) -> tuple[list[float], float, float] | None:
    """Retourne (verticals, top_y, footer_y) pour une page, ou None si non trouvé."""
    t = find_header_table(page)
    if t is None:
        return None
    cells = t.rows[0].cells
    verticals = [cells[0][0]] + [c[2] for c in cells]
    # zone data = sous l'en-tête, avant le pied (Date: / Page x de y)
    top = t.bbox[3]
    bottom = page.height - 15
    # Tenter de détecter la baseline du footer pour exclure
    words = page.extract_words()
    for w in words:
        text = w["text"]
        if text.startswith("Date") or re.match(r"Page\b", text):
            # uniquement si en bas de page
            if w["top"] > page.height * 0.85:
                bottom = min(bottom, w["top"] - 2)
    return verticals, top, bottom


def bucket_words(page: Any, verticals: list[float], top_y: float, bottom_y: float) -> list[dict[str, Any]]:
    """Retourne une liste de mots avec leur colonne assignée."""
    out = []
    for w in page.extract_words(x_tolerance=2, y_tolerance=2):
        if w["top"] < top_y or w["top"] > bottom_y:
            continue
        cx = (w["x0"] + w["x1"]) / 2
        col = None
        for i in range(len(verticals) - 1):
            if verticals[i] <= cx < verticals[i + 1]:
                col = i
                break
        if col is None:
            continue
        out.append({"col": col, "x0": w["x0"], "y": w["top"], "text": w["text"]})
    return out


def assemble_text(words: list[dict[str, Any]]) -> str:
    """Assemble une liste de mots en texte multi-lignes (groupés par y)."""
    if not words:
        return ""
    by_line = defaultdict(list)
    for w in words:
        key = round(w["y"] / 4) * 4
        by_line[key].append(w)
    lines = []
    for key in sorted(by_line):
        line_words = sorted(by_line[key], key=lambda w: w["x0"])
        lines.append(" ".join(w["text"] for w in line_words))
    return "\n".join(lines).strip()


def split_entries_by_date(words: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Pour chaque date trouvée en col 2, crée une entrée vaccin."""
    # Trouver les ancrages (lignes contenant une date YYYY/MM/DD dans col 2)
    date_ys: list[tuple[float, str]] = []
    seen = set()
    by_line = defaultdict(list)
    for w in words:
        key = round(w["y"] / 4) * 4
        by_line[key].append(w)

    for key in sorted(by_line):
        col2_text = " ".join(w["text"] for w in by_line[key] if w["col"] == 2)
        m = DATE_RE.search(col2_text)
        if m and key not in seen:
            seen.add(key)
            date_ys.append((float(key), m.group(1)))

    if not date_ys:
        return []

    # Frontières entre entrées = milieu entre dates consécutives
    boundaries = [-1e9]
    for i in range(len(date_ys) - 1):
        mid = (date_ys[i][0] + date_ys[i + 1][0]) / 2
        boundaries.append(mid)
    boundaries.append(1e9)

    entries = []
    for i, (anchor_y, _) in enumerate(date_ys):
        y_min, y_max = boundaries[i], boundaries[i + 1]
        bucket = [[] for _ in range(5)]
        for w in words:
            if y_min <= w["y"] < y_max:
                bucket[w["col"]].append(w)
        entry = {
            "vaccin_administre_nom_commercial": assemble_text(bucket[0]),
            "protege_contre_maladies": assemble_text(bucket[1]),
            "date_age_administration": assemble_text(bucket[2]),
            "quantite_voie_administration": assemble_text(bucket[3]),
            "professionnel_lieu_administration": assemble_text(bucket[4]),
            "_anchor_y": anchor_y,
        }
        entries.append(entry)
    return entries


def extract_patient_info(full_text: str) -> dict[str, str | None]:
    text = re.sub(r"[ \t]+", " ", full_text or "")
    nom = None
    m = re.search(r"\bNom\s*[:\-]?\s*([^\n]+)", text, flags=re.IGNORECASE)
    if m:
        candidate = m.group(1).strip()
        candidate = re.split(
            r"\s*(?:Date de naissance|Naissance|DDN|NAM|Sexe)\b",
            candidate, maxsplit=1, flags=re.IGNORECASE,
        )[0]
        nom = candidate.strip(" :-") or None

    dob = None
    m = re.search(
        r"\b(?:Date de naissance|Naissance|DDN)\s*[:\-]?\s*(\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})",
        text, flags=re.IGNORECASE,
    )
    if m:
        dob = m.group(1).strip()
    return {"nom": nom, "date_naissance": dob}


def extract_pdf(pdf_path: Path, include_raw: bool = False) -> dict[str, Any]:
    vaccines: list[dict[str, Any]] = []
    raw_pages = []
    warnings: list[str] = []

    with pdfplumber.open(pdf_path) as pdf:
        for idx, page in enumerate(pdf.pages, start=1):
            text = page.extract_text(x_tolerance=1, y_tolerance=3) or ""
            raw_pages.append({"page": idx, "text": text})

            geo = page_verticals(page)
            if geo is None:
                warnings.append(f"Page {idx}: en-tête non détecté, ignorée.")
                continue
            verticals, top_y, bottom_y = geo
            words = bucket_words(page, verticals, top_y, bottom_y)
            for entry in split_entries_by_date(words):
                entry["page"] = idx
                entry.pop("_anchor_y", None)
                vaccines.append(entry)

        full_text = "\n".join(p["text"] for p in raw_pages)
        patient = extract_patient_info(full_text)

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
        return result


def main() -> int:
    parser = argparse.ArgumentParser(description="Extrait un carnet de vaccination PDF en JSON.")
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--pretty", action="store_true")
    parser.add_argument("--include-raw", action="store_true")
    args = parser.parse_args()
    if not args.pdf.exists():
        print(f"PDF introuvable: {args.pdf}", file=sys.stderr)
        return 1
    result = extract_pdf(args.pdf, include_raw=args.include_raw)
    print(json.dumps(result, ensure_ascii=False, indent=2 if args.pretty else None))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
