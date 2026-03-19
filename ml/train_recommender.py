# Required Libraries

import json
import os

import joblib # Used to save/load trained ML model
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, roc_auc_score
from sklearn.model_selection import train_test_split
from skill_aliases import canonicalize_skill   # Normalizes skill names



# Define Dataset and Artifact Paths


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "data", "Dataset.csv")
ARTIFACT_DIR = os.path.join(BASE_DIR, "artifacts")

# Create artifacts folder if it doesn't exist
os.makedirs(ARTIFACT_DIR, exist_ok=True)



# Utility: Normalize text (used for location comparison)

def normalize(value):
    return str(value).strip().lower()



# Utility: Convert skills CSV string into normalized skill set
# Example: "React, JS" → {"react", "javascript"}

def text_to_skill_set(text):
    return set(
        [
            canonicalize_skill(item)
            for item in str(text).split(",")
            if canonicalize_skill(item)
        ]
    )



# Feature Engineering Function
# Converts dataset rows into numeric ML features

def build_features(df):

    # Convert skills columns into sets
    candidate_skill_sets = df["candidate_skills"].apply(text_to_skill_set)
    required_skill_sets = df["job_required_skills"].apply(text_to_skill_set)

    overlap_count = []
    overlap_ratio = []
    location_match = []

    # Loop through each candidate-job pair
    for cset, rset, cloc, jloc in zip(
        candidate_skill_sets,
        required_skill_sets,
        df["candidate_location"],
        df["job_location"],
    ):
        # Calculate matched skills
        intersection = cset.intersection(rset)

        overlap_count.append(len(intersection))
        overlap_ratio.append(len(intersection) / len(rset) if len(rset) > 0 else 0.0)

        # Check if candidate and job location match
        location_match.append(1 if normalize(cloc) == normalize(jloc) else 0)

    # Create DataFrame of features
    features = pd.DataFrame(
        {
            # Convert experience columns to numeric
            "candidate_experience_years": pd.to_numeric(
                df["candidate_experience_years"], errors="coerce"
            ).fillna(0),

            "job_min_experience_years": pd.to_numeric(
                df["job_min_experience_years"], errors="coerce"
            ).fillna(0),

            "overlap_count": overlap_count,
            "overlap_ratio": overlap_ratio,
            "location_match": location_match,
        }
    )

    # Calculate experience fit (0 to 1)
    features["experience_fit"] = np.where(
        features["job_min_experience_years"] > 0,
        np.minimum(
            features["candidate_experience_years"]
            / features["job_min_experience_years"],
            1.0,
        ),
        1.0,
    )

    return features


# Main Training Function
def main():

    # Ensure dataset exists
    if not os.path.exists(DATA_PATH):
        raise FileNotFoundError(f"Dataset not found at {DATA_PATH}")

    # Load dataset
    df = pd.read_csv(DATA_PATH)

    # Validate required columns
    required_columns = [
        "candidate_id",
        "candidate_skills",
        "candidate_experience_years",
        "candidate_location",
        "job_id",
        "job_title",
        "job_description",
        "job_required_skills",
        "job_min_experience_years",
        "job_location",
        "job_type",
        "applied_label",
    ]

    missing_columns = [col for col in required_columns if col not in df.columns]
    if missing_columns:
        raise ValueError(f"Missing columns in Dataset.csv: {missing_columns}")

    # Build numeric feature matrix (X)
    X = build_features(df)

    # Target variable (y)
    y = (
        pd.to_numeric(df["applied_label"], errors="coerce")
        .fillna(0)
        .astype(int)
    )

    # Split data into training and testing sets (80% train, 20% test)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Initialize Logistic Regression model
    model = LogisticRegression(max_iter=300, class_weight="balanced")

    # Train the model
    model.fit(X_train, y_train)

    # Predict probabilities on test set
    probabilities = model.predict_proba(X_test)[:, 1]

    # Convert probabilities to binary predictions
    predictions = (probabilities >= 0.5).astype(int)

    # Evaluate performance
    auc_score = roc_auc_score(y_test, probabilities)
    cls_report = classification_report(y_test, predictions, output_dict=True)

    # Define artifact file paths
    model_path = os.path.join(ARTIFACT_DIR, "recommender_model.pkl")
    feature_path = os.path.join(ARTIFACT_DIR, "feature_columns.json")
    metrics_path = os.path.join(ARTIFACT_DIR, "metrics.json")

    # Save trained model
    joblib.dump(model, model_path)

    # Save feature column names (important for inference)
    with open(feature_path, "w", encoding="utf-8") as file:
        json.dump(list(X.columns), file, indent=2)

    # Save evaluation metrics
    with open(metrics_path, "w", encoding="utf-8") as file:
        json.dump(
            {"auc": auc_score, "classification_report": cls_report},
            file,
            indent=2,
        )

    # Print results
    print(f"AUC: {auc_score:.4f}")
    print(f"Saved model: {model_path}")
    print(f"Saved features: {feature_path}")
    print(f"Saved metrics: {metrics_path}")


# Run training if file executed directly
if __name__ == "__main__":
    main()