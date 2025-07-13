from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Optional
import csv
import io
import os
import openai
import pandas as pd
import base64
import math
import re
import dotenv

dotenv.load_dotenv(dotenv.find_dotenv())

AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_API_URL = os.getenv("AZURE_OPENAI_API_URL")
AZURE_OPENAI_DEPLOYMENT_ID = os.getenv("AZURE_OPENAI_DEPLOYMENT_ID")

client = openai.AzureOpenAI(
    api_key=AZURE_OPENAI_API_KEY,
    api_version="2024-02-15-preview",
    azure_endpoint=AZURE_OPENAI_API_URL,
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def parse_csv_dataset(csv_text: str):
    reader = csv.DictReader(io.StringIO(csv_text))
    data = list(reader)
    for row in data:
        for k, v in row.items():
            try:
                row[k] = float(v)
            except Exception:
                pass
    return data

def parse_excel_dataset(excel_b64: str):
    excel_bytes = base64.b64decode(excel_b64)
    df = pd.read_excel(io.BytesIO(excel_bytes))
    data = df.to_dict(orient="records")
    for row in data:
        for k, v in row.items():
            try:
                row[k] = float(v)
            except Exception:
                pass
    return data

def sanitize_json(data):
    if isinstance(data, dict):
        return {k: sanitize_json(v) for k, v in data.items()}
    elif isinstance(data, list):
        return [sanitize_json(v) for v in data]
    elif isinstance(data, float):
        if math.isnan(data) or math.isinf(data):
            return None
        return data
    else:
        return data

def fill_competitor_defaults(comp, fields=None):
    if fields is None:
        fields = ["revenue", "nps", "r_d_spend", "regions", "retention_rate"]
    normalized = {}
    for k, v in comp.items():
        key = k.strip().lower().replace(" ", "_").replace("&", "and").replace(".", "").replace("-", "_")
        normalized[key] = v
    for f in fields:
        if f not in normalized or normalized[f] is None or normalized[f] == "":
            normalized[f] = 0 if f != "nps" else "-"
    return normalized

def parse_ai_response(text):
    insight = ""
    recommendations = []
    weaknesses = []
    section = None
    lines = text.splitlines()
    for line in lines:
        l = line.strip()
        if re.match(r"(\*\*)?insight(\*\*)?:", l, re.I):
            section = "insight"
            insight = ""
            l = re.sub(r"(\*\*)?insight(\*\*)?:", "", l, flags=re.I).strip()
            if l:
                insight += l
        elif re.match(r"(\*\*)?recommendations(\*\*)?:", l, re.I):
            section = "recommendations"
        elif re.match(r"(\*\*)?weaknesses(\*\*)?:", l, re.I):
            section = "weaknesses"
        elif section == "recommendations" and (re.match(r"[-*] ", l) or re.match(r"\d+\. ", l)):
            rec = re.sub(r"^([-*]|\d+\.)\s*", "", l)
            recommendations.append(rec)
        elif section == "weaknesses" and (re.match(r"[-*] ", l) or re.match(r"\d+\. ", l)):
            w = re.sub(r"^([-*]|\d+\.)\s*", "", l)
            weaknesses.append(w)
        elif section == "insight" and l:
            insight += " " + l
    return {
        "insight": insight.strip(),
        "recommendations": recommendations,
        "weaknesses": weaknesses
    }

@app.get("/api/metrics")
def get_metrics():
    return {
        "your_company": {
            "revenue": 7.5,
            "nps": 48,
            "r_d_spend": 12,
            "regions": 3,
            "retention_rate": 82
        },
        "competitor": {
            "revenue": 10.8,
            "nps": 64,
            "r_d_spend": 18,
            "regions": 6,
            "retention_rate": 90
        }
    }

@app.post("/api/metrics")
async def post_metrics(request: Request):
    body = await request.json()
    your_company = body.get("your_company")
    dataset = body.get("dataset")
    dataset_filename = body.get("dataset_filename")
    competitors = []
    if dataset and dataset_filename:
        if dataset_filename.endswith(".csv"):
            competitors = parse_csv_dataset(dataset)
        elif dataset_filename.endswith(".xlsx") or dataset_filename.endswith(".xls"):
            try:
                if not dataset.strip().startswith("UEsDB") and not dataset.strip().startswith("0M8R4"):
                    dataset_b64 = base64.b64encode(dataset.encode("utf-8")).decode("utf-8")
                else:
                    dataset_b64 = dataset
                competitors = parse_excel_dataset(dataset_b64)
            except Exception as e:
                competitors = []
    if not competitors:
        competitors = [{
            "name": "Default Competitor",
            "revenue": 10.8,
            "nps": 64,
            "r_d_spend": 18,
            "regions": 6,
            "retention_rate": 90
        }]
    competitors = [fill_competitor_defaults(c) for c in competitors]
    return sanitize_json({"your_company": your_company, "competitors": competitors})

@app.post("/api/insights")
async def get_insights(request: Request):
    body = await request.json()
    your_company = body.get("your_company")
    competitor = body.get("competitor")
    prompt = f"""
You are a world-class business analyst AI. Compare the following company to its competitor and generate:
- A strategic insight paragraph
- 3 actionable recommendations
- Highlight the biggest weaknesses and suggest AI-powered moves

Your Company: {your_company}
Competitor: {competitor}

Respond in this format:
Insight: <paragraph>\nRecommendations: <list>\nWeaknesses: <list>
"""
    try:
        response = client.chat.completions.create(
            model=AZURE_OPENAI_DEPLOYMENT_ID,
            messages=[
                {"role": "system", "content": "You are a world-class business analyst AI."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=400,
        )
        text = response.choices[0].message.content
    except Exception as e:
        text = f"[AI error: {e}]"
    print("\n[AI RAW RESPONSE]\n", text)
    parsed = parse_ai_response(text)
    print("[AI PARSED]", parsed)
    if not parsed["insight"] and not parsed["recommendations"] and not parsed["weaknesses"]:
        parsed = {
            "insight": "No AI insight could be generated. Please check your API key, quota, or try again later.",
            "recommendations": ["Try refreshing the insight.", "Check backend logs for errors.", "Ensure your Azure OpenAI setup is correct."],
            "weaknesses": []
        }
    return parsed

@app.post("/api/simulation")
async def run_simulation(request: Request):
    body = await request.json()
    your_company = body.get("your_company", {})
    competitor = body.get("competitor", {})
    scenario = body.get("scenario", "")

    new_company = your_company.copy()
    commentary = "No change applied."
    if "r&d" in scenario.lower() and "10%" in scenario:
        try:
            new_company["r_d_spend"] = round(float(your_company.get("r_d_spend", 0)) * 1.10, 2)
            commentary = "R&D spend increased by 10% as per scenario."
        except Exception:
            pass

    prompt = f"Given this scenario: '{scenario}', here are the new company metrics: {new_company}. Compare to competitor: {competitor}. What is the likely impact?"
    try:
        response = client.chat.completions.create(
            model=AZURE_OPENAI_DEPLOYMENT_ID,
            messages=[
                {"role": "system", "content": "You are a world-class business analyst AI."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=200,
        )
        ai_comment = response.choices[0].message.content
    except Exception as e:
        ai_comment = f"[AI error: {e}]"

    return {
        "your_company": new_company,
        "commentary": f"{commentary}\n\nAI: {ai_comment}"
    } 