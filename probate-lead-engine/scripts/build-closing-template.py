#!/usr/bin/env python3
"""Build the sanitized HeirRight Closing template and coordinate field map.

The source is an operator-supplied, filled example packet. This script keeps only
the actual form pages, removes known historical deal values, and emits a blank
immutable PDF plus the exact rectangles where deterministic values may be drawn.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
from pathlib import Path

import fitz


FORMS = [
    {"id": "fund-transfer-bank-account-transfer", "title": "Fund Transfer / Bank Account Transfer", "pages": [2, 3, 4], "required": ["seller_heirs", "property_address", "folio", "transfer_amount", "buyer_entity"]},
    {"id": "contract-for-deed", "title": "Contract for Deed", "pages": [8], "required": ["seller_heirs", "buyer_entity", "property_address", "folio", "legal_description", "transfer_amount"]},
    {"id": "quit-claim-deed", "title": "Quit Claim Deed", "pages": [11, 12], "required": ["seller_heirs", "buyer_entity", "property_address", "folio", "legal_description", "seller_mailing_address", "seller_marital_status"]},
    {"id": "limited-power-of-attorney", "title": "Limited Power of Attorney", "pages": [14, 15], "required": ["seller_heirs", "representative", "property_address"]},
    {"id": "assignment-of-surplus-rights", "title": "Assignment of Surplus Rights Purchase Agreement", "pages": [17, 18, 19, 20], "required": ["seller_heirs", "buyer_entity", "property_address", "folio", "foreclosure_case"]},
    {"id": "same-name-affidavit", "title": "Same Name Affidavit", "pages": [23], "required": ["seller_heirs", "name_variants"]},
    {"id": "joinder-waiver-consent", "title": "Joinder, Waiver and Consent", "pages": [25], "required": ["deceased_name", "seller_heirs", "probate_case"]},
    {"id": "affidavit-of-heirs", "title": "Affidavit of Heirs", "pages": [27, 28, 29, 30, 31, 32], "required": ["deceased_name", "seller_heirs", "heir_relationships", "probate_case"]},
    {"id": "valuable-consideration-disbursement", "title": "Valuable Consideration Disbursement", "pages": [34, 35], "required": ["seller_heirs", "buyer_entity", "property_address", "valuable_consideration_amount"]},
    {"id": "assignment-disclaimer-interest", "title": "Assignment and Disclaimer of Interest", "pages": [37, 38], "required": ["deceased_name", "seller_heirs", "disclaimer_recipient", "probate_case"]},
    {"id": "land-trust-agreement", "title": "Land Trust Agreement", "pages": [40, 41, 42, 43, 44, 45, 46, 47], "required": ["trust_name", "property_address", "folio", "legal_description", "settlor_entity", "trustee", "beneficiary"]},
    {"id": "tax-reimbursement", "title": "Tax Reimbursement Credit", "pages": [49], "required": ["property_address", "folio", "tax_paid_by", "taxes_due", "deceased_name"]},
    {"id": "buyer-purchase-agreement", "title": "Buyer Purchase Agreement", "pages": [51, 52], "required": ["buyer_entity", "seller_heirs", "property_address", "folio", "legal_description", "purchase_price"]},
    {"id": "unclaimed-funds-instructions", "title": "Unclaimed Funds Instructions", "pages": [54], "required": ["claimant_last_name", "claimant_first_name", "claimant_city"]},
]


# Values are scoped to source pages so a legal clause is never erased merely
# because it shares a common word with a historical deal value.
REDACTIONS = [
    (2, "trust_name", "HeirRight, LLC, as Trustee of the 3400 Ave Land Trust U/A/D"),
    (2, "trust_date", "02/28/2026"), (2, "seller_heirs", "Betty J. Davis"),
    (2, "seller_phone", "619.255.2297"), (2, "property_address", "3400 WILLIAM AVE, MIAMI, FL 33133"),
    (2, "folio", "01-4121-007-4830"), (2, "transfer_amount", "$88,783.75"),
    (3, "deceased_name", "Sarah Mack"), (3, "recipient_name", "Gwendolyn Cynthia Mack"),
    (3, "recipient_share", "¼ interest ($6,591.94)"), (3, "unclaimed_funds_amount", "$26,367.77"),
    (3, "account_source", "Florida Unclaimed Funds (From JP Morgan Chase)"),
    (3, "seller_heirs", "Betty J Davis"), (3, "representative", "Joshua Anthony Hernandez"),
    (8, "seller_heirs", "Betty J. Davis"),
    (8, "trust_name", "HeirRight, LLC as Trustee of the 3400 Ave Land Trust U/A/D 02/28/2026"),
    (8, "property_address", "3400 WILLIAM AVE, MIAMI, FL 33133"), (8, "folio", "01-4121-007-4830"),
    (8, "legal_description", "FROW HOMESTEAD PB B-106 LOT 6 BLK 29"),
    (8, "transfer_amount", "$88,783.75"), (8, "valuable_consideration_amount", "$150.00"),
    (11, "buyer_entity", "HeirRight, LLC"), (11, "buyer_address", "360 NW 27th ST, 8th Floor, Miami, FL 33127"),
    (11, "buyer_address", "360 NW 27 ST, Floor 8, Miami, FL, 33127"),
    (11, "folio", "01-4121-007-4830"), (11, "closing_date_long", "28th day of February 2026"),
    (11, "seller_heirs", "Betty J Davis"), (11, "seller_marital_status", "a single woman"),
    (11, "seller_mailing_address", "366 REXVIEW DR, SAN DIEGO, CA 92114"),
    (11, "trust_name", "HeirRight, LLC, as Trustee of the 3400 Ave Land Trust U/A/D 02/28/2026"),
    (11, "legal_description", "Lot 6, Block 29, of FROW HOMESTEAD, according to the plat thereof recorded in Plat Book B at page 106, of the Public Records of Miami-Dade County, Florida."),
    (11, "property_address", "3400 WILLIAM AVE, MIAMI, FL 33133"),
    (11, "homestead_address", "366 REXVIEW DR, SAN DIEGO, CA 92114"),
    (12, "seller_heirs", "BETTY J. DAVIS"),
    (14, "property_address", "3400 WILLIAM AVE, MIAMI, FL 33133"), (14, "seller_heirs", "Betty J. Davis"),
    (14, "representative", "Joshua Anthony Hernandez"), (15, "seller_heirs", "Betty J. Davis"),
    (17, "buyer_entity", "HeirRight, LLC"), (17, "buyer_address", "360 NW 27th St, Floor 8, Miami, FL 33127"),
    (17, "buyer_address", "360 NW 27th St"), (17, "buyer_address", "8th Floor"),
    (17, "buyer_address", "Miami, FL 33127"),
    (17, "seller_heirs", "Betty J. Davis"), (17, "property_address", "3400 WILLIAM AVE, MIAMI, FL 33133"),
    (17, "folio", "01-4121-007-4830"), (17, "foreclosure_case", "N/A"),
    (17, "foreclosure_sale_date", "N/A"), (20, "seller_heirs", "Betty J. Davis"),
    (20, "representative", "Joshua Anthony Hernandez"),
    (25, "deceased_name", "James D. Davis Jr"), (25, "seller_heirs", "Betty J. Davis"),
    (34, "valuable_consideration_amount_words", "One Hundred & Fifty Dollars"),
    (34, "valuable_consideration_amount", "$150.00"), (34, "seller_heirs", "Betty J. Davis"),
    (37, "deceased_name", "Rogers, Willie Jr."), (37, "disclaimer_recipient", "Deborah Belinda Dobson"),
    (40, "trust_name", "HeirRight, LLC as Trustee of the 2470 Land Trust U/A/D 03/12/2026"),
    (40, "property_address", "2470 NW 179 ST, MIAMI GARDENS, FL 33056"),
    (40, "trust_date_long", "March 12, 2026"), (40, "settlor_entity", "TEXAS EQUITY PROS, LLC"),
    (40, "trustee", "HeirRight, LLC"), (40, "folio", "34-2110-030-0020"),
    (40, "beneficiary", "TEXAS EQUITY PROS, LLC"), (40, "beneficiary_address", "360 NW 27 ST, FLOOR 8"),
    (40, "beneficiary_address", "Miami, FL 33127"),
    (45, "representative", "Joshua Hernandez"), (45, "settlor_entity", "TEXAS EQUITY PROS, LLC"),
    (45, "trustee", "HeirRight, LLC"), (46, "representative", "Joshua Hernandez"),
    (46, "settlor_entity", "TEXAS EQUITY PROS, LLC"), (46, "trustee", "HeirRight, LLC"),
    (46, "trust_name", "2470 Land Trust U/A/D 03/12/2026"),
    (47, "legal_description", "Lot 2, Block 1, of ENTIN ESTATES, according to the plat thereof recorded in Plat Book 91 at page 61, of the Public Records of Miami-Dade County, Florida."),
    (49, "property_address", "1785 NW 52nd St, Miami, FL 33142"), (49, "folio", "01-3122-051-0101"),
    (49, "tax_paid_by", "Nathan Robinson"), (49, "taxes_due", "$12,000"), (49, "deceased_name", "Thelma Hutto"),
    (51, "trust_name", "HeirRight, LLC, as Trustee of the 302 Ter Land Trust U/A/D 01/16/2026"),
    (51, "property_address", "15023 SW 302 TERR, HOMESTEAD, FL 33033"),
    (51, "legal_description", "PALMLAND HOMES SOUTH NO FIVE PB 89-48 LOT 12 BLK 15"),
    (51, "folio", "30-7909-015-0400"), (51, "purchase_price", "$342,000.00"),
    (51, "acceptance_deadline", "01/11/26"), (51, "deposit_amount", "$10,000.00"),
    (51, "deposit_holder", "AMB Title (Ana Brito; 5966 South Dixie Hwy Ste 300, South Miami, Fl 33143)"),
    (51, "deposit_deadline", "February 11, 2026 5pm"), (51, "seller_entity", "Somi Home Buyers LLC"),
    (51, "broker_commission", "2.5%"), (51, "extension_per_diem", "$500.00"),
    (52, "seller_entity", "HeirRight, LLC"),
    (54, "claimant_last_name", "Mack"), (54, "claimant_first_name", "Sarah"),
    (54, "claimant_city", "Miami Gardens"),
]


MANUAL_FIELDS = [
    # source page, field, anchor text, x offset, y offset, width, height
    (2, "bank_account_owner", "Bank ACH/Wire Transfer Name on account:", 250, -2, 185, 15),
    (2, "bank_name", "Bank name:", 70, -2, 190, 15),
    (2, "bank_routing", "ABA/Routing No.:", 105, -2, 185, 15),
    (2, "bank_account_number", "Account number:", 95, -2, 185, 15),
    (2, "check_mailing_address", "Check: please provide the mailing address:", 245, -2, 260, 15),
    (23, "closing_date", "Date:", 35, -2, 180, 15),
    (23, "buyer_entity", "Purchaser(s):", 75, -2, 235, 15),
    (23, "seller_heirs", "Seller(s):", 55, -2, 250, 15),
    (23, "probate_case", "File No.:", 48, -2, 190, 15),
    (23, "name_variants", "Printed Name", 0, 22, 250, 45),
    (25, "probate_case", "File No.", 48, -2, 120, 15),
    (27, "seller_heirs", "My name is:", 70, -2, 260, 15),
    (27, "deceased_name", "I knew the decedent,", 105, -2, 235, 15),
    (27, "heir_relationships", "an interest in the estate of the decedent as follows:", 275, -2, 245, 15),
    (34, "property_address", "Property Address:", 100, -2, 180, 15),
    (34, "closing_date", "Date:", 35, -2, 145, 15),
    (34, "seller_heirs", "Grantor:", 50, -2, 180, 15),
    (34, "buyer_entity", "Grantee:", 50, -2, 180, 15),
    (37, "seller_heirs", "COMES NOW,", 75, -2, 215, 15),
    (37, "death_date", "died intestate on", 90, -2, 120, 15),
    (37, "death_place", "in", 18, -2, 130, 15),
    (51, "buyer_entity", "(“Buyer”)", -225, -2, 210, 15),
]


FORBIDDEN = [
    "Betty J. Davis", "Betty J Davis", "Antrinika Mack", "Sarah Mack",
    "Gwendolyn Cynthia Mack", "James D. Davis Jr", "Rogers, Willie Jr.",
    "Deborah Belinda Dobson", "Nathan Robinson", "Thelma Hutto",
    "Joshua Anthony Hernandez", "Joshua Hernandez",
    "3400 WILLIAM", "2470 NW 179", "1785 NW 52", "15023 SW 302",
    "366 REXVIEW", "01-4121-007-4830", "34-2110-030-0020",
    "01-3122-051-0101", "30-7909-015-0400",
    "360 NW 27th St", "360 NW 27 ST, FLOOR 8", "8th Floor",
]


# These historical values wrap across lines, but their replacement belongs at
# the first blank only. Every matched fragment is still redacted.
FIRST_PLACEMENT_ONLY = {
    (11, "seller_marital_status"),
}


def rect_json(rect: fitz.Rect) -> list[float]:
    return [round(rect.x0, 2), round(rect.y0, 2), round(rect.width, 2), round(rect.height, 2)]


def grouped_matches(matches: list[fitz.Rect]) -> list[fitz.Rect]:
    """Merge wrapped lines from one searched value, but keep repeated values separate."""
    groups: list[fitz.Rect] = []
    for match in sorted(matches, key=lambda item: (item.y0, item.x0)):
        if groups and 0 <= match.y0 - groups[-1].y1 <= 5:
            groups[-1] |= match
        else:
            groups.append(fitz.Rect(match))
    return groups


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output-pdf", required=True, type=Path)
    parser.add_argument("--output-map", required=True, type=Path)
    parser.add_argument("--output-module", type=Path)
    args = parser.parse_args()

    source = fitz.open(args.source)
    selected_pages = [page for form in FORMS for page in form["pages"]]
    output = fitz.open()
    source_to_output: dict[int, int] = {}
    for source_page in selected_pages:
        source_to_output[source_page] = len(output)
        output.insert_pdf(source, from_page=source_page - 1, to_page=source_page - 1)

    placements: dict[str, list[dict[str, object]]] = {}
    misses: list[str] = []
    for source_page, field, text in REDACTIONS:
        if source_page not in source_to_output:
            continue
        page = output[source_to_output[source_page]]
        matches = page.search_for(text)
        if not matches:
            misses.append(f"page {source_page}: {field}: {text}")
            continue
        for match in matches:
            padded = fitz.Rect(match.x0 - 1.5, match.y0 - 1, match.x1 + 1.5, match.y1 + 1)
            page.add_redact_annot(padded, fill=(1, 1, 1))
        grouped = grouped_matches(matches)
        if (source_page, field) in FIRST_PLACEMENT_ONLY:
            grouped = grouped[:1]
        for match in grouped:
            padded = fitz.Rect(match.x0 - 1.5, match.y0 - 1, match.x1 + 1.5, match.y1 + 1)
            placements.setdefault(field, []).append({
                "page": source_to_output[source_page],
                "rect": rect_json(padded),
                "fontSize": round(max(6, min(10, match.height * 0.72)), 2),
                "sourcePage": source_page,
            })

    for source_page, field, anchor, dx, dy, width, height in MANUAL_FIELDS:
        page = output[source_to_output[source_page]]
        matches = page.search_for(anchor)
        if not matches:
            misses.append(f"page {source_page}: {field}: anchor {anchor}")
            continue
        anchor_rect = matches[0]
        rect = fitz.Rect(anchor_rect.x0 + dx, anchor_rect.y0 + dy, anchor_rect.x0 + dx + width, anchor_rect.y0 + dy + height)
        placements.setdefault(field, []).append({
            "page": source_to_output[source_page],
            "rect": rect_json(rect),
            "fontSize": 8,
            "sourcePage": source_page,
        })

    if misses:
        raise SystemExit("Template mapping failed:\n" + "\n".join(misses))

    for page in output:
        # The filled examples include flattened yellow highlight rectangles behind
        # historical values. Removing touched line art clears those rectangles
        # inside the same bounded field areas without changing legal copy.
        page.apply_redactions(
            images=fitz.PDF_REDACT_IMAGE_NONE,
            graphics=fitz.PDF_REDACT_LINE_ART_REMOVE_IF_TOUCHED,
        )

    args.output_pdf.parent.mkdir(parents=True, exist_ok=True)
    args.output_map.parent.mkdir(parents=True, exist_ok=True)
    output.set_metadata({
        "title": "HeirRight Closing Templates v1",
        "author": "HeirRight",
        "subject": "Sanitized deterministic Closing Prep templates",
        "creator": "HeirRight template sanitizer",
        "producer": "HeirRight template sanitizer",
        "creationDate": "D:20260712000000-04'00'",
        "modDate": "D:20260712000000-04'00'",
    })
    output.save(args.output_pdf, garbage=4, deflate=True, clean=True, no_new_id=True)
    output.close()
    source.close()

    sanitized = fitz.open(args.output_pdf)
    sanitized_text = "\n".join(page.get_text() for page in sanitized)
    survivors = [value for value in FORBIDDEN if value.lower() in sanitized_text.lower()]
    if survivors:
        sanitized.close()
        args.output_pdf.unlink(missing_ok=True)
        raise SystemExit("Historical values survived sanitization: " + ", ".join(survivors))
    sanitized.close()

    template_hash = hashlib.sha256(args.output_pdf.read_bytes()).hexdigest()
    page_cursor = 0
    forms = []
    for form in FORMS:
        count = len(form["pages"])
        forms.append({
            "id": form["id"], "title": form["title"],
            "pages": list(range(page_cursor, page_cursor + count)),
            "requiredFields": form["required"],
        })
        page_cursor += count
    field_map = {
        "version": 1,
        "templateId": "heirright-closing-templates-v1",
        "templateHash": template_hash,
        "pageCount": page_cursor,
        "forms": forms,
        "fields": placements,
    }
    args.output_map.write_text(json.dumps(field_map, indent=2, sort_keys=True) + "\n")
    if args.output_module:
        args.output_module.parent.mkdir(parents=True, exist_ok=True)
        encoded = base64.b64encode(args.output_pdf.read_bytes()).decode("ascii")
        module = (
            "// Generated by scripts/build-closing-template.py. Do not edit manually.\n"
            f"export const CLOSING_TEMPLATE_BASE64 = {json.dumps(encoded)};\n"
            f"export const CLOSING_FIELD_MAP = {json.dumps(field_map, separators=(',', ':'))} as const;\n"
            "export function closingTemplateBytes(): Uint8Array {\n"
            "  const binary = atob(CLOSING_TEMPLATE_BASE64);\n"
            "  const bytes = new Uint8Array(binary.length);\n"
            "  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);\n"
            "  return bytes;\n"
            "}\n"
        )
        args.output_module.write_text(module)
    print(json.dumps({"ok": True, "pageCount": page_cursor, "fieldCount": len(placements), "placementCount": sum(map(len, placements.values())), "templateHash": template_hash}, indent=2))


if __name__ == "__main__":
    main()
