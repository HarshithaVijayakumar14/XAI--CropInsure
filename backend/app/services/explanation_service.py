from typing import List, Dict, Any, Optional

class FarmerFriendlyExplanationService:
    @staticmethod
    def generate_explanation(
        claim_data: Dict[str, Any],
        task_type: str,
        prediction_label: Optional[str],
        prediction_probability: Optional[float],
        payout_estimate: Optional[float],
        base_value: Optional[float],
        shap_contributions: List[Dict[str, Any]],
        data_quality_warnings: List[str]
    ) -> Dict[str, Any]:
        """
        Translates complex ML outputs and SHAP attributions into farmer-friendly, transparent language.
        Strictly adheres to ethical and scientific guidelines:
        - Never presents model output as proof of physical damage or legal approval.
        - Explains missing or flagged variables accurately.
        - Emphasizes mandatory human assessor review.
        """
        # Separate positive and negative contributors
        positive_factors = [c for c in shap_contributions if c.get("direction") == "positive"]
        negative_factors = [c for c in shap_contributions if c.get("direction") == "negative"]

        # 1. Estimation Summary
        if task_type == "classification":
            prob_pct = f"{round(prediction_probability * 100, 1)}%" if prediction_probability is not None else "N/A"
            if prediction_label == "Approved" or (prediction_probability is not None and prediction_probability >= 0.5):
                headline = (
                    f"The machine-learning model indicates that this claim shares characteristics with "
                    f"historically approved claims (estimated pattern match probability: {prob_pct})."
                )
            else:
                headline = (
                    f"The machine-learning model indicates that this claim shares characteristics with "
                    f"claims that were historically rejected or required further scrutiny (estimated pattern match probability: {prob_pct})."
                )
        else:
            payout_str = f"₹{payout_estimate:,.2f}" if payout_estimate is not None else "Unavailable"
            headline = (
                f"The model estimated a hypothetical payout benchmark of {payout_str} based on historical payout data."
            )

        # 2. Key Influential Factors
        top_pos = positive_factors[:3]
        top_neg = negative_factors[:3]

        pos_descriptions = []
        for f in top_pos:
            feat_name = f.get("feature_name_display", f.get("feature", "Factor"))
            obs = f.get("observed_value")
            pos_descriptions.append(f"{feat_name} (observed: {obs})")

        neg_descriptions = []
        for f in top_neg:
            feat_name = f.get("feature_name_display", f.get("feature", "Factor"))
            obs = f.get("observed_value")
            neg_descriptions.append(f"{feat_name} (observed: {obs})")

        paragraphs = [headline]

        if pos_descriptions:
            paragraphs.append(
                f"Factors supporting higher claim likelihood: {', '.join(pos_descriptions)}. "
                f"These conditions align with patterns of agricultural stress observed in past records."
            )

        if neg_descriptions:
            paragraphs.append(
                f"Factors lowering claim likelihood: {', '.join(neg_descriptions)}. "
                f"These indicators suggest adequate moisture, stable vegetation vigor, or mitigating circumstances during the observation window."
            )

        # 3. Data Quality & Missing Evidence
        missing_notes = []
        if data_quality_warnings:
            missing_notes = data_quality_warnings
            paragraphs.append(
                f"Data quality & evidence notice: {'; '.join(data_quality_warnings[:3])}"
            )
        else:
            paragraphs.append("Data quality review: All core meteorological and satellite vegetation indicators were present and within normal physical bounds.")

        # 4. Mandatory Human Review & Legal Disclaimer
        disclaimer = (
            "IMPORTANT DECISION SUPPORT NOTICE: This automated assessment reflects statistical pattern matching "
            "and does NOT constitute a final legal or financial determination. Under PMFBY and agricultural insurance guidelines, "
            "an authorized human claim assessor must independently verify local field conditions, loss assessment reports (CCEs), "
            "and policy provisions before making any final decision."
        )
        paragraphs.append(disclaimer)

        full_summary = "\n\n".join(paragraphs)

        return {
            "summary_text": full_summary,
            "headline": headline,
            "positive_factors": [f.get("feature_name_display") for f in top_pos],
            "negative_factors": [f.get("feature_name_display") for f in top_neg],
            "missing_evidence": missing_notes
        }

