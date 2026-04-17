# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
from dataclasses import dataclass
import json
import re


@allow_storage
@dataclass
class Dispute:
    id: str
    submitter: Address
    claim: str
    evidence: str
    verdict: str
    reason: str


class AIDisputeResolver(gl.Contract):
    next_dispute_id: u32
    disputes: TreeMap[str, Dispute]

    def __init__(self):
        self.next_dispute_id = u32(1)

    def _to_dict(self, d: Dispute) -> dict:
        return {
            "id": d.id,
            "submitter": str(d.submitter),
            "claim": d.claim,
            "evidence": d.evidence,
            "verdict": d.verdict,
            "reason": d.reason,
        }

    def _safe_parse(self, text: str):
        try:
            return json.loads(text)
        except:
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(0))
                except:
                    return None
            return None

    @gl.public.write
    def submit_dispute(self, claim: str, evidence: str) -> dict:
        if not claim.strip():
            raise gl.vm.UserError("Claim cannot be empty")

        if len(claim) > 800 or len(evidence) > 800:
            raise gl.vm.UserError("Claim or evidence too long")

        # STEP 1: run AI FIRST (no storage touched yet)
        result = gl.eq_principle.prompt_non_comparative(
            lambda: f"""
            You are a neutral judge.

            Return ONLY JSON:
            {{\"verdict\":\"guilty|not_guilty|insufficient_evidence\",\"reason\":\"short sentence\"}}

            Claim: {claim}
            Evidence: {evidence}
            """,
            task="Resolve dispute",
            criteria="Return valid JSON with verdict and reason",
        )

        verdict = "parsing_error"
        reason = "LLM did not return valid JSON"

        data = self._safe_parse(result.strip())

        if data:
            v = str(data.get("verdict", "error")).lower().replace(" ", "_")
            if v in ["guilty", "not_guilty", "insufficient_evidence"]:
                verdict = v
            reason = str(data.get("reason", "No reason provided"))

        # STEP 2: NOW do storage (after AI is done)
        dispute_id = str(int(self.next_dispute_id))
        self.next_dispute_id = u32(int(self.next_dispute_id) + 1)

        sender = gl.message.sender_address

        record = Dispute(
            id=dispute_id,
            submitter=sender,
            claim=claim,
            evidence=evidence,
            verdict=verdict,
            reason=reason,
        )

        self.disputes[dispute_id] = record

        return self._to_dict(record)

    @gl.public.view
    def get_dispute(self, dispute_id: str) -> dict:
        if dispute_id not in self.disputes:
            raise gl.vm.UserError("Dispute not found")
        return self._to_dict(self.disputes[dispute_id])
