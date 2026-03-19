# Required libraries
import argparse # Used to read command-line arguments
import json # Used to read input JSON and print output JSON

import joblib # Loads the trained ML model (.pkl file)
import numpy as np # Used for numeric operations (probability → score)
import pandas as pd # Used to create DataFrame for model input
from skill_aliases import canonicalize_skill  # Normalizes skill names


# Normalize text (used mainly for location comparison)
def normalize(value):
    return str(value).strip().lower()


# Convert comma-separated skills string into normalized skill set
# Example: "React, JS" → {"react", "javascript"}
def text_to_skill_set(text):
    return set(
        [
            canonicalize_skill(item)
            for item in str(text).split(",")
            if canonicalize_skill(item)
        ]
    )


# Build feature rows for inference
# Returns:
# 1) DataFrame of numeric features (for ML model)
# 2) Metadata list (job details for output)
def build_feature_rows(candidate, jobs):

    # Extract candidate details
    candidate_skills = text_to_skill_set(candidate.get("skills_csv", ""))
    candidate_exp = float(candidate.get("experience_years", 0) or 0)
    candidate_loc = candidate.get("location", "")

    features = []   # Will store ML input rows
    metadata = []   # Will store job details for output

    # Process each job
    for job in jobs:
        required_skills = text_to_skill_set(job.get("required_skills_csv", ""))
        min_exp = float(job.get("min_experience_years", 0) or 0)
        job_loc = job.get("location", "")

        # Find matched and missing skills
        matched = sorted(list(candidate_skills.intersection(required_skills)))
        missing = sorted(list(required_skills - candidate_skills))

        # Feature calculations
        overlap_count = len(matched)
        overlap_ratio = overlap_count / len(required_skills) if required_skills else 0.0

        # Check if locations match
        location_match = (
            1
            if normalize(candidate_loc) == normalize(job_loc)
            and candidate_loc
            and job_loc
            else 0
        )

        # Experience fit (0 to 1)
        experience_fit = min(candidate_exp / min_exp, 1.0) if min_exp > 0 else 1.0

        # Append numeric feature row
        features.append(
            {
                "candidate_experience_years": candidate_exp,
                "job_min_experience_years": min_exp,
                "overlap_count": overlap_count,
                "overlap_ratio": overlap_ratio,
                "location_match": location_match,
                "experience_fit": experience_fit,
            }
        )

        # Append metadata for final output
        metadata.append(
            {
                "jobId": job.get("jobId"),
                "jobTitle": job.get("jobTitle"),
                "companyName": job.get("companyName"),
                "companyLogo": job.get("companyLogo", ""),
                "location": job_loc,
                "jobType": job.get("jobType", ""),
                "workMode": job.get("workMode", ""),
                "requiredSkillsCount": len(required_skills),
                "matchedSkills": matched,
                "missingSkills": missing,
            }
        )

    return pd.DataFrame(features), metadata


# Main function for running inference
def main():

    # Define command-line arguments
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)       # Path to trained model
    parser.add_argument("--features", required=True)    # Path to feature_columns.json
    parser.add_argument("--input", required=True)       # Path to input JSON
    parser.add_argument("--topk", type=int, default=10) # Number of recommendations to return
    args = parser.parse_args()

    # Load trained model
    model = joblib.load(args.model)

    # Load feature column order used during training
    with open(args.features, "r", encoding="utf-8") as file:
        feature_columns = json.load(file)

    # Load candidate and jobs input JSON
    with open(args.input, "r", encoding="utf-8") as file:
        payload = json.load(file)

    candidate = payload.get("candidate", {})
    jobs = payload.get("jobs", [])

    # If no jobs available, return empty recommendations
    if not jobs:
        print(json.dumps({"recommendations": []}))
        return

    # Build features and metadata
    X, meta = build_feature_rows(candidate, jobs)

    # Ensure column order matches training
    X = X.reindex(columns=feature_columns, fill_value=0)

    # Predict probability of class 1 (good match)
    probabilities = model.predict_proba(X)[:, 1]

    # Convert probability (0-1) into score (0-100)
    scores = np.round(probabilities * 100).astype(int)

    recommendations = []

    # Build recommendation output
    for index, item in enumerate(meta):

        matched_count = len(item["matchedSkills"])
        required_count = int(item.get("requiredSkillsCount", 0) or 0)

        # Calculate skill match percentage
        skill_match_percent = (
            int(round((matched_count / required_count) * 100))
            if required_count > 0
            else 0
        )

        # Create simple explanation
        reasons = [f"Matched {matched_count} of {required_count} required skills"]

        recommendations.append(
            {
                **item,
                "score": int(scores[index]),
                "skillMatchPercent": skill_match_percent,
                "probability": float(probabilities[index]),
                "reasons": reasons,
            }
        )

    # Sort by skill match first, then by ML score
    recommendations.sort(
        key=lambda row: (
            row.get("skillMatchPercent", 0),
            row.get("score", 0),
        ),
        reverse=True,
    )

    # Keep only top-k results
    recommendations = recommendations[: args.topk]

    # Print final recommendations JSON
    print(json.dumps({"recommendations": recommendations}, ensure_ascii=False))


if __name__ == "__main__":
    main()