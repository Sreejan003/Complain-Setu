#!/usr/bin/env python3
"""
Complain Setu - AICTE Institution Data Extractor & Quality Validation Pipeline
Processes all 794 pages of Institute_List.pdf, extracts 5 columns, validates,
detects duplicates and conflicts, and produces canonical and audited outputs.
"""

import os
import re
import sys
import json
import csv
import time
from datetime import datetime
import pdfplumber

PDF_PATH = os.path.join("data", "Institute_List.pdf")
OUTPUT_DIR = "data"

STATE_TO_REGION = {
    "Andhra Pradesh": "South-Central Region (Hyderabad)",
    "Telangana": "South-Central Region (Hyderabad)",
    "Karnataka": "South-Western Region (Bangalore)",
    "Kerala": "South-Western Region (Bangalore)",
    "Lakshadweep": "South-Western Region (Bangalore)",
    "Tamil Nadu": "Southern Region (Chennai)",
    "Puducherry": "Southern Region (Chennai)",
    "Maharashtra": "Western Region (Mumbai)",
    "Goa": "Western Region (Mumbai)",
    "Daman and Diu": "Western Region (Mumbai)",
    "Dadra and Nagar Haveli": "Western Region (Mumbai)",
    "Gujarat": "Central Region (Bhopal)",
    "Madhya Pradesh": "Central Region (Bhopal)",
    "Chhattisgarh": "Central Region (Bhopal)",
    "Uttar Pradesh": "Northern Region (Kanpur)",
    "Uttarakhand": "Northern Region (Kanpur)",
    "Punjab": "North-Western Region (Chandigarh)",
    "Haryana": "North-Western Region (Chandigarh)",
    "Delhi": "North-Western Region (Chandigarh)",
    "Rajasthan": "North-Western Region (Chandigarh)",
    "Himachal Pradesh": "North-Western Region (Chandigarh)",
    "Jammu and Kashmir": "North-Western Region (Chandigarh)",
    "Chandigarh": "North-Western Region (Chandigarh)",
    "West Bengal": "Eastern Region (Kolkata)",
    "Orissa": "Eastern Region (Kolkata)",
    "Odisha": "Eastern Region (Kolkata)",
    "Bihar": "Eastern Region (Kolkata)",
    "Jharkhand": "Eastern Region (Kolkata)",
    "Assam": "Eastern Region (Kolkata)",
    "Meghalaya": "Eastern Region (Kolkata)",
    "Manipur": "Eastern Region (Kolkata)",
    "Mizoram": "Eastern Region (Kolkata)",
    "Nagaland": "Eastern Region (Kolkata)",
    "Tripura": "Eastern Region (Kolkata)",
    "Arunachal Pradesh": "Eastern Region (Kolkata)",
    "Sikkim": "Eastern Region (Kolkata)",
    "Andaman and Nicobar Islands": "Eastern Region (Kolkata)",
}

def clean_text(val):
    if val is None:
        return ""
    # Normalize unicode spaces, line breaks, etc.
    text = str(val).replace("\r", " ").replace("\n", " ").strip()
    # Collapse multiple whitespace
    text = re.sub(r"\s+", " ", text)
    return text

def infer_institution_type(name):
    name_upper = name.upper()
    if "POLYTECHNIC" in name_upper or "POLYTECNIC" in name_upper or "POLOYTECHNIC" in name_upper:
        return "Polytechnic"
    if "PHARMACY" in name_upper or "PHARMACEUTICAL" in name_upper or "PHARAMCY" in name_upper:
        return "Pharmacy"
    if "MANAGEMENT" in name_upper or "BUSINESS" in name_upper or "B-SCHOOL" in name_upper or "COMMERCE" in name_upper or "MBA" in name_upper:
        return "Management"
    if "ARCHITECTURE" in name_upper:
        return "Architecture"
    return "Engineering"

def main():
    if not os.path.exists(PDF_PATH):
        print(f"Error: PDF not found at {PDF_PATH}", file=sys.stderr)
        sys.exit(1)

    print("=" * 70)
    print("STARTING AICTE INSTITUTION EXTRACTION FROM PDF")
    print(f"File: {PDF_PATH}")
    print("=" * 70)

    start_time = time.time()
    raw_records = []
    header_rows_skipped = 0
    rejected_rows = []

    with pdfplumber.open(PDF_PATH) as pdf:
        total_pages = len(pdf.pages)
        print(f"Total pages to process: {total_pages}")

        for page_idx, page in enumerate(pdf.pages):
            page_num = page_idx + 1
            if page_num % 50 == 0 or page_num == total_pages:
                print(f"Processing page {page_num}/{total_pages} ({page_num*100//total_pages}%)...")

            tables = page.extract_tables()
            if not tables or not tables[0]:
                rejected_rows.append({
                    "page": page_num,
                    "reason": "No table detected on page",
                    "raw": None
                })
                continue

            table = tables[0]
            for row_idx, row in enumerate(table):
                if not row or len(row) < 5:
                    rejected_rows.append({
                        "page": page_num,
                        "row_idx": row_idx,
                        "reason": f"Insufficient columns ({len(row) if row else 0})",
                        "raw": row
                    })
                    continue

                col0 = clean_text(row[0])
                col1 = clean_text(row[1])
                col2 = clean_text(row[2])
                col3 = clean_text(row[3])
                col4 = clean_text(row[4])

                # Check if this is the table header
                if "Permanent ID" in col0 or ("Institute" in col0 and "Name" in col1):
                    header_rows_skipped += 1
                    continue

                # Permanent ID check
                if not col0:
                    rejected_rows.append({
                        "page": page_num,
                        "row_idx": row_idx,
                        "reason": "Missing Permanent ID",
                        "raw": [col0, col1, col2, col3, col4]
                    })
                    continue

                # Basic validation
                if not col1:
                    rejected_rows.append({
                        "page": page_num,
                        "row_idx": row_idx,
                        "reason": "Missing Institution Name",
                        "raw": [col0, col1, col2, col3, col4]
                    })
                    continue

                record = {
                    "permanentId": col0,
                    "name": col1,
                    "state": col2,
                    "district": col3,
                    "city": col4,
                    "sourcePage": page_num,
                    "sourceRow": row_idx + 1
                }
                raw_records.append(record)

    extraction_duration = time.time() - start_time
    print(f"\nExtraction completed in {extraction_duration:.2f} seconds.")
    print(f"Total raw rows extracted: {len(raw_records)}")
    print(f"Header rows skipped: {header_rows_skipped}")
    print(f"Rejected rows: {len(rejected_rows)}")

    # =========================================================================
    # DEDUPLICATION & CONFLICT ANALYSIS
    # =========================================================================
    records_by_id = {}
    for r in raw_records:
        pid = r["permanentId"]
        if pid not in records_by_id:
            records_by_id[pid] = []
        records_by_id[pid].append(r)

    total_unique_ids = len(records_by_id)
    print(f"Total unique Permanent IDs: {total_unique_ids}")

    exact_duplicates = []
    conflicting_records = []
    canonical_institutions = []

    for pid, occurrences in records_by_id.items():
        if len(occurrences) == 1:
            occ = occurrences[0]
            inst_type = infer_institution_type(occ["name"])
            reg = STATE_TO_REGION.get(occ["state"], "National Jurisdiction")
            canonical_institutions.append({
                "id": f"inst-{pid.replace('-', '_')}",
                "permanentId": pid,
                "name": occ["name"],
                "state": occ["state"],
                "district": occ["district"],
                "city": occ["city"],
                "institutionType": inst_type,
                "region": reg,
                "sourceType": "PDF_IMPORT",
                "sourceFile": "Institute_List.pdf",
                "sourcePage": occ["sourcePage"],
                "sourceDocumentDate": "2013-09-18",
                "verificationStatus": "UNVERIFIED",
                "occurrencesCount": 1,
                "sourcePages": [occ["sourcePage"]]
            })
        else:
            # Check if all occurrences have identical details
            first = occurrences[0]
            is_identical = True
            for other in occurrences[1:]:
                if (first["name"] != other["name"] or
                    first["state"] != other["state"] or
                    first["district"] != other["district"] or
                    first["city"] != other["city"]):
                    is_identical = False
                    break

            if is_identical:
                pages = [o["sourcePage"] for o in occurrences]
                exact_duplicates.append({
                    "permanentId": pid,
                    "name": first["name"],
                    "state": first["state"],
                    "district": first["district"],
                    "city": first["city"],
                    "occurrences": len(occurrences),
                    "pages": pages
                })
                inst_type = infer_institution_type(first["name"])
                reg = STATE_TO_REGION.get(first["state"], "National Jurisdiction")
                canonical_institutions.append({
                    "id": f"inst-{pid.replace('-', '_')}",
                    "permanentId": pid,
                    "name": first["name"],
                    "state": first["state"],
                    "district": first["district"],
                    "city": first["city"],
                    "institutionType": inst_type,
                    "region": reg,
                    "sourceType": "PDF_IMPORT",
                    "sourceFile": "Institute_List.pdf",
                    "sourcePage": first["sourcePage"],
                    "sourceDocumentDate": "2013-09-18",
                    "verificationStatus": "UNVERIFIED",
                    "occurrencesCount": len(occurrences),
                    "sourcePages": pages
                })
            else:
                conflicting_records.append({
                    "permanentId": pid,
                    "occurrences": occurrences,
                    "reviewStatus": "FLAGGED_FOR_ADMIN_REVIEW",
                    "reason": "Conflicting geographic or institutional attributes across source pages"
                })
                # As per Phase 3 instruction:
                # Retain both source versions in an import conflict log and flag for review.
                # For canonical index, retain primary version (e.g. first appearance) flagged with conflict metadata.
                inst_type = infer_institution_type(first["name"])
                reg = STATE_TO_REGION.get(first["state"], "National Jurisdiction")
                canonical_institutions.append({
                    "id": f"inst-{pid.replace('-', '_')}",
                    "permanentId": pid,
                    "name": first["name"],
                    "state": first["state"],
                    "district": first["district"],
                    "city": first["city"],
                    "institutionType": inst_type,
                    "region": reg,
                    "sourceType": "PDF_IMPORT",
                    "sourceFile": "Institute_List.pdf",
                    "sourcePage": first["sourcePage"],
                    "sourceDocumentDate": "2013-09-18",
                    "verificationStatus": "UNVERIFIED",
                    "hasSourceConflict": True,
                    "conflictDetails": occurrences,
                    "occurrencesCount": len(occurrences),
                    "sourcePages": [o["sourcePage"] for o in occurrences]
                })

    print(f"\nDeduplication results:")
    print(f"  - Canonical records: {len(canonical_institutions)}")
    print(f"  - Exact duplicate instances: {len(exact_duplicates)}")
    for d in exact_duplicates:
        print(f"    * ID {d['permanentId']}: '{d['name']}' on pages {d['pages']}")
    print(f"  - Conflicting duplicate instances: {len(conflicting_records)}")
    for c in conflicting_records:
        print(f"    * ID {c['permanentId']}:")
        for occ in c['occurrences']:
            print(f"        Page {occ['sourcePage']}: {occ['name']} | {occ['state']} | {occ['district']} | {occ['city']}")

    # Validation checks
    unrecognized_states = set()
    for inst in canonical_institutions:
        if inst["state"] not in STATE_TO_REGION:
            unrecognized_states.add(inst["state"])

    print(f"\nUnrecognized states count: {len(unrecognized_states)}")
    if unrecognized_states:
        print(f"  Unrecognized: {unrecognized_states}")

    # Write files
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    raw_path = os.path.join(OUTPUT_DIR, "institutions_extracted_raw.json")
    with open(raw_path, "w", encoding="utf-8") as f:
        json.dump(raw_records, f, indent=2, ensure_ascii=False)
    print(f"\nSaved raw records to: {raw_path}")

    canonical_path = os.path.join(OUTPUT_DIR, "institutions_canonical.json")
    with open(canonical_path, "w", encoding="utf-8") as f:
        json.dump(canonical_institutions, f, indent=2, ensure_ascii=False)
    print(f"Saved canonical records to: {canonical_path}")

    conflicts_path = os.path.join(OUTPUT_DIR, "import_conflicts.json")
    with open(conflicts_path, "w", encoding="utf-8") as f:
        json.dump(conflicting_records, f, indent=2, ensure_ascii=False)
    print(f"Saved conflict log to: {conflicts_path}")

    # CSV output
    csv_path = os.path.join(OUTPUT_DIR, "institutions_canonical.csv")
    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "permanentId", "name", "state", "district", "city",
            "institutionType", "region", "sourcePage", "verificationStatus"
        ])
        writer.writeheader()
        for inst in canonical_institutions:
            writer.writerow({
                "permanentId": inst["permanentId"],
                "name": inst["name"],
                "state": inst["state"],
                "district": inst["district"],
                "city": inst["city"],
                "institutionType": inst["institutionType"],
                "region": inst["region"],
                "sourcePage": inst["sourcePage"],
                "verificationStatus": inst["verificationStatus"]
            })
    print(f"Saved canonical CSV to: {csv_path}")

    # Detailed report
    report = {
        "executionTimestamp": datetime.utcnow().isoformat() + "Z",
        "sourceFile": "Institute_List.pdf",
        "pdfMetadata": {
            "author": "Surabhi Patil",
            "creationDate": "2013-09-18",
            "producer": "Microsoft Excel 2010"
        },
        "totalPagesProcessed": 794,
        "totalRowsExtracted": len(raw_records),
        "headerRowsSkipped": header_rows_skipped,
        "rejectedRowsCount": len(rejected_rows),
        "rejectedRows": rejected_rows,
        "totalUniquePermanentIds": total_unique_ids,
        "exactDuplicatesCount": len(exact_duplicates),
        "exactDuplicates": exact_duplicates,
        "conflictingDuplicatesCount": len(conflicting_records),
        "conflictingDuplicates": conflicting_records,
        "canonicalInstitutionsCount": len(canonical_institutions),
        "unrecognizedStates": list(unrecognized_states),
        "executionTimeSeconds": round(time.time() - start_time, 2)
    }

    report_path = os.path.join(OUTPUT_DIR, "extraction_validation_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    print(f"Saved extraction report to: {report_path}")
    print("=" * 70)

if __name__ == "__main__":
    main()
