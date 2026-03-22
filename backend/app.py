from flask import Flask, request, jsonify
from flask_cors import CORS
from anthropic import Anthropic
from dotenv import load_dotenv
import os
import json

# ============================================================
# AI PROVIDER CONFIGURATION
# This app uses Anthropic Claude by default.
# To switch providers, uncomment the relevant section below
# and comment out the Anthropic section.
# ============================================================

# --- ANTHROPIC CLAUDE (current) ---
# pip install anthropic
# Add to .env: ANTHROPIC_API_KEY=your_key
from anthropic import Anthropic
client = Anthropic()

# --- OPENAI ---
# pip install openai
# Add to .env: OPENAI_API_KEY=your_key
# from openai import OpenAI
# client = OpenAI()
# Then replace the client.messages.create() call in explain_policy()
# with: client.chat.completions.create(model="gpt-4", messages=[...])

# --- GOOGLE GEMINI ---
# pip install google-generativeai
# Add to .env: GEMINI_API_KEY=your_key
# import google.generativeai as genai
# genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
# Then replace the client.messages.create() call with Gemini's equivalent

load_dotenv()

app = Flask(__name__)
CORS(app)

load_dotenv()

app = Flask(__name__)
CORS(app)

client = Anthropic()

def build_prompt(policy_json):
    return f"""You are an AWS IAM security expert.

Analyze this IAM policy and respond ONLY with valid JSON.
No markdown, no backticks, no explanation outside the JSON.

Return exactly this structure:
{{
  "summary": "One clear sentence explaining what this policy allows",
  "severity": "high or low",
  "risks": ["risk 1", "risk 2", "risk 3"],
  "recommendations": ["recommendation 1", "recommendation 2"],
  "hardened_policy": {{"Version": "2012-10-17", "Statement": []}}
}}

Rules:
- Severity is high if the policy is overly permissive or dangerous
- Severity is low if the policy is specific and well scoped
- hardened_policy must be a complete valid IAM policy JSON with all security issues fixed
- Apply least privilege principle to the hardened policy
- Replace wildcards with specific actions and resources
- Add conditions where appropriate such as MFA or IP restrictions

IAM Policy to analyze:
{policy_json}"""

@app.route('/explain', methods=['POST'])
def explain_policy():
    data = request.get_json()

    if not data or 'policy' not in data:
        return jsonify({'error': 'No policy provided'}), 400

    policy_text = data['policy']

    try:
        json.loads(policy_text)
    except json.JSONDecodeError:
        return jsonify({'error': 'Invalid JSON. Please check your policy.'}), 400

    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=2000,
            messages=[
                {"role": "user", "content": build_prompt(policy_text)}
            ]
        )

        raw_response = message.content[0].text
        clean_response = raw_response.replace('```json', '').replace('```', '').strip()
        parsed = json.loads(clean_response)

        return jsonify(parsed)

    except json.JSONDecodeError:
        return jsonify({'error': 'AI returned invalid format. Try again.'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', debug=True, port=5000)
