# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
from dataclasses import dataclass
import json
import re


@allow_storage
@dataclass
class Dispute:
    id: u64
    submitter: Address
    claim: str
    evidence: str
    verdict: str
    reason: str


class AIDisputeResolver(gl.Contract):
    next_dispute_id: u64
    disputes: TreeMap[u64, Dispute]
    dispute_owner: TreeMap[u64, Address]

    def __init__(self):
        self.next_dispute_id = u64(1)

    def _to_dict(self, d: Dispute) -> dict:
        return {
            "id": int(d.id),
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
            raise Exception("Claim cannot be empty")
        if len(claim) > 800 or len(evidence) > 800:
            raise Exception("Claim or evidence too long")

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

        dispute_id = self.next_dispute_id
        self.next_dispute_id = u64(int(self.next_dispute_id) + 1)

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
        self.dispute_owner[dispute_id] = sender

        return self._to_dict(record)

    @gl.public.view
    def get_dispute(self, dispute_id: u64) -> dict:
        if dispute_id not in self.disputes:
            raise Exception("Dispute not found")
        return self._to_dict(self.disputes[dispute_id])

    @gl.public.view
    def get_latest_dispute(self) -> dict:
        if int(self.next_dispute_id) == 1:
            return {}
        last_id = u64(int(self.next_dispute_id) - 1)
        return self._to_dict(self.disputes[last_id])

    @gl.public.view
    def get_my_dispute_ids(self, user: Address) -> list:
        ids = []
        i = 1
        upper = int(self.next_dispute_id)
        while i < upper:
            uid = u64(i)
            if uid in self.dispute_owner and self.dispute_owner[uid] == user:
                ids.append(i)
            i += 1
        return ids

    @gl.public.view
    def get_my_disputes(self, user: Address) -> list:
        out = []
        i = 1
        upper = int(self.next_dispute_id)
        while i < upper:
            uid = u64(i)
            if uid in self.dispute_owner and self.dispute_owner[uid] == user:
                out.append(self._to_dict(self.disputes[uid]))
            i += 1
        return out
