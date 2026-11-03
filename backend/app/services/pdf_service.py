import os
from datetime import datetime
from typing import Dict, Any, List
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from backend.app.config import settings

def generate_claim_pdf_report(
    claim: Any,
    assessment: Any,
    model: Any,
    shap_contributions: List[Dict[str, Any]],
    output_filename: str
) -> str:
    """
    Generates a professional, structured PDF report for crop-insurance claim assessment.
    """
    os.makedirs(settings.REPORTS_DIR, exist_ok=True)
    file_path = os.path.join(settings.REPORTS_DIR, output_filename)

    doc = SimpleDocTemplate(
        file_path,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()
    normal_style = styles["Normal"]
    
    # Custom Styles
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#14532d"), # dark green
        alignment=1
    )
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#475569"),
        alignment=1
    )
    section_heading = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=15,
        textColor=colors.HexColor("#166534"),
        spaceBefore=10,
        spaceAfter=4
    )
    disclaimer_style = ParagraphStyle(
        "Disclaimer",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#991b1b"), # dark red
        alignment=1
    )
    body_style = ParagraphStyle(
        "BodyDark",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1e293b")
    )
    bold_body = ParagraphStyle(
        "BoldBodyDark",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#0f172a")
    )

    story = []

    # 1. Header & Title
    story.append(Paragraph("XAI-CropInsure", title_style))
    story.append(Paragraph("Explainable AI for Transparent Crop-Insurance Claim Assessment", subtitle_style))
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#16a34a"), spaceAfter=10))

    # 2. Disclaimer Banner
    disclaimer_text = (
        "<b>DECISION SUPPORT NOTICE:</b> This report provides machine-learning decision support. "
        "It is not an official insurance approval, rejection, or guaranteed payout determination. "
        "Final decisions must follow the applicable insurance policy, verified local evidence, and authorized review procedures."
    )
    disclaimer_table = Table([[Paragraph(disclaimer_text, disclaimer_style)]], colWidths=[540])
    disclaimer_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#fef2f2")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#fca5a5")),
        ('PADDING', (0,0), (-1,-1), 6),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ]))
    story.append(disclaimer_table)
    story.append(Spacer(1, 10))

    # 3. Meta Information Table
    gen_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    meta_data = [
        [
            Paragraph(f"<b>Claim Reference:</b> {claim.claim_reference}", body_style),
            Paragraph(f"<b>Report Date:</b> {gen_time}", body_style)
        ],
        [
            Paragraph(f"<b>Model:</b> {model.model_name if model else 'N/A'} ({model.model_version if model else ''})", body_style),
            Paragraph(f"<b>Workflow Status:</b> {claim.status}", body_style)
        ]
    ]
    meta_table = Table(meta_data, colWidths=[270, 270])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('PADDING', (0,0), (-1,-1), 5),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 10))

    # 4. Farmer and Agricultural Overview
    story.append(Paragraph("1. Farmer & Agricultural Overview", section_heading))
    farm_info = [
        [
            Paragraph(f"<b>Farmer Name:</b> {claim.farmer_name}", body_style),
            Paragraph(f"<b>Policy Ref:</b> {claim.policy_reference}", body_style)
        ],
        [
            Paragraph(f"<b>Location:</b> {claim.district}, {claim.state}", body_style),
            Paragraph(f"<b>Insurance Scheme:</b> {claim.insurance_scheme}", body_style)
        ],
        [
            Paragraph(f"<b>Crop & Season:</b> {claim.crop_type} ({claim.season})", body_style),
            Paragraph(f"<b>Cultivated Area:</b> {claim.cultivated_area} Hectares", body_style)
        ],
        [
            Paragraph(f"<b>Sowing Date:</b> {claim.sowing_date}", body_style),
            Paragraph(f"<b>Claim Window:</b> {claim.claim_start_date} to {claim.claim_end_date}", body_style)
        ]
    ]
    farm_table = Table(farm_info, colWidths=[270, 270])
    farm_table.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(farm_table)
    story.append(Spacer(1, 10))

    # 5. Environmental & Satellite Evidence
    story.append(Paragraph("2. Environmental & Remote Sensing Observations", section_heading))
    env_rows = [
        ["Variable", "Observed Value", "Reference Baseline", "Derived Anomaly / Deficit"],
        [
            "Rainfall (mm)",
            f"{claim.observed_rainfall} mm",
            f"{claim.reference_rainfall} mm",
            f"{claim.reference_rainfall - claim.observed_rainfall:.1f} mm deficit"
        ],
        [
            "Vegetation Index (NDVI)",
            f"{claim.current_ndvi:.3f}",
            f"{claim.reference_ndvi:.3f}",
            f"{claim.current_ndvi - claim.reference_ndvi:+.3f} change"
        ],
        [
            "Temperature (°C)",
            f"{claim.observed_temperature} °C",
            f"{claim.reference_temperature} °C",
            f"{claim.observed_temperature - claim.reference_temperature:+.1f} °C anomaly"
        ],
        [
            "Soil Moisture (%)",
            f"{claim.soil_moisture}%" if claim.soil_moisture is not None else "Not Available",
            "Seasonal Benchmark",
            "Field moisture observation"
        ]
    ]
    env_table = Table(env_rows, colWidths=[140, 130, 130, 140])
    env_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#f1f5f9")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor("#0f172a")),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('FONTSIZE', (0,0), (-1,-1), 8.5),
        ('PADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(env_table)
    story.append(Spacer(1, 10))

    # 6. Model Assessment & SHAP Contributions
    story.append(Paragraph("3. Model-Based Assessment & SHAP Explanations", section_heading))
    pred_text = f"<b>Predicted Pattern Match:</b> {assessment.prediction_label or 'N/A'}"
    if assessment.prediction_probability is not None:
        pred_text += f" (Confidence / Probability: {assessment.prediction_probability*100:.1f}%)"
    if assessment.payout_estimate is not None:
        pred_text += f" | <b>Estimated Payout Benchmark:</b> ₹{assessment.payout_estimate:,.2f}"

    pred_table = Table([[Paragraph(pred_text, bold_body)]], colWidths=[540])
    pred_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#ecfdf5")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#6ee7b7")),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(pred_table)
    story.append(Spacer(1, 6))

    # SHAP table
    shap_rows = [["Feature", "Observed", "SHAP Impact", "Direction", "Context"]]
    for item in shap_contributions[:6]:
        direction_color = "#16a34a" if item.get("direction") == "positive" else "#dc2626"
        shap_rows.append([
            item.get("feature_name_display", item.get("feature")),
            str(item.get("observed_value")),
            f"{item.get('shap_value'):+.4f}",
            item.get("direction", "").capitalize(),
            item.get("interpretation", "")[:60] + "..."
        ])

    shap_table = Table(shap_rows, colWidths=[120, 70, 70, 60, 220])
    shap_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#f1f5f9")),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('PADDING', (0,0), (-1,-1), 3),
    ]))
    story.append(shap_table)
    story.append(Spacer(1, 10))

    # 7. Farmer-Friendly Narrative
    story.append(Paragraph("4. Farmer-Friendly Summary", section_heading))
    narrative_p = Paragraph(assessment.farmer_friendly_summary.replace("\n", "<br/>"), body_style)
    narrative_table = Table([[narrative_p]], colWidths=[540])
    narrative_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(narrative_table)
    story.append(Spacer(1, 12))

    # 8. Human Review & Assessor Sign-Off
    story.append(Paragraph("5. Authorized Human Review & Assessor Sign-off", section_heading))
    sign_data = [
        [
            Paragraph("<b>Assessor Name:</b> ___________________________", body_style),
            Paragraph("<b>Official Decision:</b> [  ] Approved  [  ] Rejected  [  ] Evid. Req.", body_style)
        ],
        [
            Paragraph("<b>Assessor Signature:</b> ________________________", body_style),
            Paragraph("<b>Date:</b> ___________________________", body_style)
        ],
        [
            Paragraph("<b>Assessor Notes:</b> _____________________________________________________________________________", body_style),
            Paragraph("", body_style)
        ]
    ]
    sign_table = Table(sign_data, colWidths=[270, 270])
    sign_table.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(sign_table)

    doc.build(story)
    return file_path

