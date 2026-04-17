# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import typing
import json

class AIDisputeResolver(gl.Contract):
    verdict: str
    reason: str
    claim_text: str
    evidence: str

    def __init__(self):
        self.verdict = ""
        self.reason = ""
        self.claim_text = ""
        self.evidence = ""

    @gl.public.write
    def submit_dispute(self, claim: str, evidence: str) -> typing.Any:
        if len(claim) > 800 or len(evidence) > 800 or not claim.strip():
            raise Exception("Claim or evidence too long or empty")
        self.claim_text = claim
        self.evidence = evidence
        
        result = gl.eq_principle.prompt_non_comparative(
            lambda: f"""
            <system>You are a neutral, fair judge on the GenLayer Court.</system>
            <claim>{claim}</claim>
            <evidence>{evidence}</evidence>
            <task>Return ONLY valid JSON. No extra text.</task>
            <output_format>{{"verdict": "guilty|not_guilty|insufficient_evidence", "reason": "one short clear sentence"}}</output_format>
            """,
            task="Resolve the dispute fairly",
            criteria="Must return valid JSON with verdict and reason fields only"
        )

        try:
            data = json.loads(result.strip())
            self.verdict = str(data.get("verdict", "error"))
            self.reason = str(data.get("reason", "No reason provided"))
        except:
            self.verdict = "parsing_error"
            self.reason = "LLM did not return valid JSON"

    @gl.public.view
    def get_verdict(self) -> dict:
        return {
            "verdict": self.verdict,
            "reason": self.reason,
            "claim": self.claim_text,
            "evidence": self.evidence
        }
