from dotenv import load_dotenv
import os
import requests
from concurrent.futures import ThreadPoolExecutor

load_dotenv()

FEATHERLESS_API_KEY = os.getenv("FEATHERLESS_API_KEY")

def call_featherless(prompt):
    try:
        response = requests.post(
            "https://api.featherless.ai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {FEATHERLESS_API_KEY}",
                "Content-Type": "application/json"
            },
            json={
                "model": "moonshot-ai/Kimi-K2-Instruct",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 500,
                "temperature": 0.3
            },
            timeout=30
        )
        response.raise_for_status()
        return response.json()['choices'][0]['message']['content']
    except requests.exceptions.Timeout:
        return "Error: Request timed out. Please retry."
    except requests.exceptions.RequestException as e:
        return f"Error: API call failed — {str(e)}"
    except (KeyError, IndexError):
        return "Error: Unexpected response format from model."

def generate_communication(patient_data, prediction_output):

    technical_prompt = f"""You are a stroke neurology assistant. 
Generate a clinical brief for the attending physician.

PATIENT DATA:
- Age: {patient_data['age']}, Gender: {patient_data['gender']}
- NIHSS Score: {patient_data['nihss_score']} 
- ASPECTS Score: {patient_data['aspects_score']}
- Clot Location: {patient_data['clot_location']}
- Penumbra Volume: {patient_data['penumbra_volume_ml']}ml
- Core Infarct: {patient_data['core_infarct_volume_ml']}ml
- Onset to Door: {patient_data['onset_to_door_min']} minutes

PREDICTION OUTPUT:
- Predicted mRS: {prediction_output['predicted_mrs']}
- Functional Independence Probability: {prediction_output['independence_prob']}%
- Urgency Tier: {prediction_output['urgency_tier']}
- Top Risk Factors: {prediction_output['top_features']}

OUTPUT FORMAT:
1. Urgency tier and recommended door-to-puncture target
2. Key biomarkers driving this prediction
3. tPA consideration given time math
4. One specific watchpoint for this patient profile
5. Estimated outcome range if treated within window

Maximum 100 words. Clinical language."""

    family_prompt = f"""You are helping a neurologist communicate 
with a frightened family during a stroke emergency.

PATIENT CONTEXT:
- {patient_data['age']} year old patient
- Clot location: {patient_data['clot_location']}
- Brain tissue at risk: {patient_data['penumbra_volume_ml']}ml salvageable
- Time since stroke onset: {patient_data['onset_to_door_min']} minutes
- Predicted outcome: {prediction_output['mrs_plain_english']}
- Treatment window: {prediction_output['time_window_minutes']} minutes remaining
- Outcome probability now: {prediction_output['independence_prob']}%

Write exactly three paragraphs:
1. What is happening in the brain right now in plain English
2. Why the next {prediction_output['time_window_minutes']} minutes 
   matter for this specific patient
3. What a good outcome looks like and what the team is doing

CONSTRAINTS:
- Zero medical jargon without immediate plain explanation
- Warm but honest, no false hope
- Reference the specific numbers above
- Maximum 150 words total
- End with one sentence the family can hold onto"""

    # Run both calls in parallel
    with ThreadPoolExecutor(max_workers=2) as executor:
        technical_future = executor.submit(call_featherless, technical_prompt)
        family_future = executor.submit(call_featherless, family_prompt)
        
        return {
            "technical_brief": technical_future.result(),
            "family_letter": family_future.result()
        }