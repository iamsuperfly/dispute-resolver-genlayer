# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
from dataclasses import dataclass
import json


@allow_storage
@dataclass
class Dispute:
    id: str
    submitter: Address
    claim: str
    evidence: str
    verdict: str
    reason: str
    created_seq: u32


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
            "created_seq": int(d.created_seq),
        }

    @gl.public.write
    def submit_dispute(self, claim: str, evidence: str) -> dict:
        if not claim.strip():
            raise gl.vm.UserError("Claim cannot be empty")

        if len(claim) > 800 or len(evidence) > 800:
            raise gl.vm.UserError("Claim or evidence too long")

        dispute_id = str(int(self.next_dispute_id))
        sender = gl.message.sender_address

        # ✅ AI RUNS HERE (allowed pattern)
        result = gl.eq_principle.prompt_non_comparative(
            lambda: f"""
You are a neutral judge.

Respond ONLY with valid JSON.
Do NOT include explanations or markdown.

Format:
{{"verdict":"guilty|not_guilty|insufficient_evidence","reason":"short sentence"}}

Claim: {claim}
Evidence: {evidence}
""",
            task="Resolve dispute",
            criteria="Return valid JSON with verdict and reason",
        )

        verdict = "parsing_error"
        reason = "LLM did not return valid JSON"

        try:
            data = json.loads(result.strip())
            v = str(data.get("verdict", "")).lower()

            if v in ["guilty", "not_guilty", "insufficient_evidence"]:
                verdict = v
                reason = str(data.get("reason", "No reason provided"))
        except:
            pass

        record = Dispute(
            id=dispute_id,
            submitter=sender,
            claim=claim,
            evidence=evidence,
            verdict=verdict,
            reason=reason,
            created_seq=self.next_dispute_id,
        )

        self.disputes[dispute_id] = record
        self.next_dispute_id = u32(int(self.next_dispute_id) + 1)

        return self._to_dict(record)

    @gl.public.view
    def get_dispute(self, dispute_id: str) -> dict:
        if dispute_id not in self.disputes:
            raise gl.vm.UserError("Dispute not found")
        return self._to_dict(self.disputes[dispute_id])

    @gl.public.view
    def get_latest_dispute(self) -> dict:
        if int(self.next_dispute_id) == 1:
            return {}
        last_id = str(int(self.next_dispute_id) - 1)
        return self._to_dict(self.disputes[last_id])

    @gl.public.view
    def get_my_dispute_ids(self, user: Address) -> list:
        ids = []
        i = 1
        upper = int(self.next_dispute_id)
        while i < upper:
            key = str(i)
            if key in self.disputes and self.disputes[key].submitter == user:
                ids.append(key)
            i += 1
        return ids

    @gl.public.view
    def get_my_disputes(self, user: Address) -> list:
        out = []
        i = 1
        upper = int(self.next_dispute_id)
        while i < upper:
            key = str(i)
            if key in self.disputes and self.disputes[key].submitter == user:
                out.append(self._to_dict(self.disputes[key]))
            i += 1
        return out
