from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from langchain_core.messages import HumanMessage, SystemMessage

from app.core.llm_factory import llm_factory

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Secret detection patterns
# ---------------------------------------------------------------------------

_SECRET_PATTERNS = [
    (r'(?i)(api[_-]?key|apikey)\s*[=:]\s*["\']?([A-Za-z0-9_\-]{20,})["\']?', "API Key"),
    (r'(?i)(password|passwd|pwd)\s*[=:]\s*["\']([^"\'\s]{8,})["\']', "Password"),
    (r'(?i)(secret[_-]?key|secret)\s*[=:]\s*["\']([^"\'\s]{16,})["\']', "Secret Key"),
    (r'(?i)(access[_-]?token|auth[_-]?token)\s*[=:]\s*["\']([A-Za-z0-9_\-\.]{20,})["\']', "Auth Token"),
    (r'sk-[A-Za-z0-9]{32,}', "OpenAI API Key"),
    (r'ghp_[A-Za-z0-9]{36}', "GitHub Personal Token"),
    (r'(?i)aws[_\-]?access[_\-]?key[_\-]?id\s*[=:]\s*["\']?([A-Z0-9]{20})["\']?', "AWS Access Key"),
    (r'(?i)aws[_\-]?secret[_\-]?access[_\-]?key\s*[=:]\s*["\']?([A-Za-z0-9/+=]{40})["\']?', "AWS Secret Key"),
    (r'xox[baprs]-[A-Za-z0-9-]{10,48}', "Slack Token"),
    (r'AAAA[A-Za-z0-9_\-]{32,}', "Firebase Token"),
]

# ---------------------------------------------------------------------------
# Vulnerability patterns
# ---------------------------------------------------------------------------

_SQL_INJECTION_PATTERNS = {
    "python": [
        (r'execute\s*\(\s*["\'].*%s.*["\'].*%', "SQL string formatting — use parameterized queries"),
        (r'execute\s*\(\s*f["\'].*{', "f-string in SQL execute — use parameterized queries"),
        (r'execute\s*\(\s*["\'].*\+\s*\w', "SQL string concatenation — use parameterized queries"),
    ],
    "javascript": [
        (r'query\s*\(\s*`[^`]*\$\{', "Template literal in SQL query — use prepared statements"),
        (r'query\s*\(\s*["\'].*\+\s*\w', "SQL string concatenation in JS — use prepared statements"),
    ],
}

_XSS_PATTERNS = {
    "javascript": [
        (r'innerHTML\s*=\s*(?!["\'`][^<>]*["\'`])', "innerHTML with dynamic content — use textContent or sanitize"),
        (r'document\.write\s*\(', "document.write — XSS risk"),
        (r'eval\s*\(', "eval() — code injection risk"),
    ],
    "python": [
        (r'mark_safe\s*\(.*\+', "mark_safe with concatenation — XSS risk"),
    ],
}


@dataclass
class SecretFinding:
    severity: str
    description: str
    file_path: str
    line_number: int
    remediation: str
    pattern_type: str


@dataclass
class VulnerabilityFinding:
    severity: str
    description: str
    file_path: str
    line_number: int
    remediation: str
    vuln_type: str


@dataclass
class DependencyVulnerability:
    severity: str
    description: str
    package: str
    version: str
    remediation: str


@dataclass
class SecurityReport:
    secrets: List[SecretFinding]
    vulnerabilities: List[VulnerabilityFinding]
    dependency_issues: List[DependencyVulnerability]
    overall_severity: str
    recommendations: List[str]
    summary: str

    @property
    def total_findings(self) -> int:
        return len(self.secrets) + len(self.vulnerabilities) + len(self.dependency_issues)


class SecurityAgent:
    """Scans code for secrets, vulnerabilities, and dependency issues."""

    async def scan(
        self,
        repo_id: str,
        local_path: Optional[str] = None,
        code_snippet: Optional[str] = None,
    ) -> SecurityReport:
        from app.core.config import settings
        from app.github.cloner import RepositoryCloner

        all_secrets: List[SecretFinding] = []
        all_vulns: List[VulnerabilityFinding] = []
        all_deps: List[DependencyVulnerability] = []

        if code_snippet:
            secrets = self.detect_secrets(code_snippet, "snippet")
            all_secrets.extend(secrets)
        elif local_path or repo_id:
            path = local_path or str(Path(settings.REPOS_BASE_PATH) / repo_id)
            cloner = RepositoryCloner()
            if Path(path).exists():
                files = cloner.list_files(path)
                for rel_file in files[:200]:
                    content = cloner.read_file(path, rel_file)
                    if not content:
                        continue
                    secrets = self.detect_secrets(content, rel_file)
                    all_secrets.extend(secrets)

                    ext = Path(rel_file).suffix.lower()
                    language = "python" if ext == ".py" else (
                        "javascript" if ext in (".js", ".jsx", ".ts", ".tsx") else "other"
                    )
                    sql_vulns = self.detect_sql_injection(content, language, rel_file)
                    all_vulns.extend(sql_vulns)
                    xss_vulns = self.detect_xss(content, language, rel_file)
                    all_vulns.extend(xss_vulns)

                # Check dependencies
                req_file = None
                for f in files:
                    if Path(f).name == "requirements.txt":
                        req_file = f
                        break
                if req_file:
                    req_path = str(Path(path) / req_file)
                    dep_vulns = await self.check_dependencies(req_path)
                    all_deps.extend(dep_vulns)

        severity = self._compute_overall_severity(all_secrets, all_vulns, all_deps)
        recommendations = self._generate_recommendations(all_secrets, all_vulns, all_deps)
        summary = self._generate_summary(all_secrets, all_vulns, all_deps, severity)

        return SecurityReport(
            secrets=all_secrets,
            vulnerabilities=all_vulns,
            dependency_issues=all_deps,
            overall_severity=severity,
            recommendations=recommendations,
            summary=summary,
        )

    def detect_secrets(self, content: str, file_path: str) -> List[SecretFinding]:
        findings: List[SecretFinding] = []
        lines = content.splitlines()

        for line_num, line in enumerate(lines, 1):
            # Skip comments and test files
            stripped = line.strip()
            if stripped.startswith(("#", "//", "*", "<!--")) and "secret" not in stripped.lower():
                continue
            if "test" in file_path.lower() or "example" in file_path.lower():
                if "PLACEHOLDER" in line or "YOUR_" in line or "xxx" in line.lower():
                    continue

            for pattern, pattern_type in _SECRET_PATTERNS:
                if re.search(pattern, line):
                    findings.append(
                        SecretFinding(
                            severity="critical",
                            description=f"Potential {pattern_type} found in source code",
                            file_path=file_path,
                            line_number=line_num,
                            remediation=f"Move {pattern_type} to environment variables. "
                                       f"Use .env files and never commit secrets to version control.",
                            pattern_type=pattern_type,
                        )
                    )
                    break  # One finding per line

        return findings

    def detect_sql_injection(
        self, content: str, language: str, file_path: str
    ) -> List[VulnerabilityFinding]:
        findings: List[VulnerabilityFinding] = []
        patterns = _SQL_INJECTION_PATTERNS.get(language, [])
        lines = content.splitlines()

        for line_num, line in enumerate(lines, 1):
            for pattern, remediation in patterns:
                if re.search(pattern, line):
                    findings.append(
                        VulnerabilityFinding(
                            severity="high",
                            description="Potential SQL injection vulnerability",
                            file_path=file_path,
                            line_number=line_num,
                            remediation=remediation,
                            vuln_type="sql_injection",
                        )
                    )
                    break

        return findings

    def detect_xss(
        self, content: str, language: str, file_path: str
    ) -> List[VulnerabilityFinding]:
        findings: List[VulnerabilityFinding] = []
        patterns = _XSS_PATTERNS.get(language, [])
        lines = content.splitlines()

        for line_num, line in enumerate(lines, 1):
            for pattern, remediation in patterns:
                if re.search(pattern, line):
                    findings.append(
                        VulnerabilityFinding(
                            severity="high",
                            description="Potential Cross-Site Scripting (XSS) vulnerability",
                            file_path=file_path,
                            line_number=line_num,
                            remediation=remediation,
                            vuln_type="xss",
                        )
                    )
                    break

        return findings

    async def check_dependencies(
        self, requirements_path: str
    ) -> List[DependencyVulnerability]:
        """
        Check dependencies against known vulnerable versions.
        This is a basic check; in production use Safety or OWASP Dependency Check.
        """
        vulnerabilities: List[DependencyVulnerability] = []
        _KNOWN_VULN: Dict[str, Any] = {
            "django": {"<2.2.28": "Multiple security fixes in Django <2.2.28", "severity": "high"},
            "flask": {"<1.0": "Various vulnerabilities in Flask <1.0", "severity": "medium"},
            "requests": {"<2.20.0": "SSRF vulnerability in requests <2.20.0", "severity": "high"},
            "pillow": {"<9.0.0": "Multiple CVEs in Pillow <9.0.0", "severity": "high"},
            "cryptography": {"<41.0.0": "Deprecated algorithms in cryptography <41.0.0", "severity": "medium"},
            "pyjwt": {"<2.4.0": "Algorithm confusion attack in PyJWT <2.4.0", "severity": "high"},
        }

        try:
            content = Path(requirements_path).read_text(encoding="utf-8", errors="replace")
            for line in content.splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                # Parse package==version or package>=version
                match = re.match(r"^([a-zA-Z0-9_\-\.]+)([=><~!]+)([0-9.]+)", line)
                if not match:
                    continue
                pkg_name = match.group(1).lower()
                version_str = match.group(3)

                if pkg_name in _KNOWN_VULN:
                    info = _KNOWN_VULN[pkg_name]
                    vulnerabilities.append(
                        DependencyVulnerability(
                            severity=info.get("severity", "medium"),
                            description=next(v for k, v in info.items() if k != "severity"),
                            package=pkg_name,
                            version=version_str,
                            remediation=f"Update {pkg_name} to the latest stable version.",
                        )
                    )
        except Exception as exc:
            logger.warning("Dependency check failed: %s", exc)

        return vulnerabilities

    def _compute_overall_severity(
        self,
        secrets: List[SecretFinding],
        vulns: List[VulnerabilityFinding],
        deps: List[DependencyVulnerability],
    ) -> str:
        if secrets or any(v.severity == "critical" for v in vulns):
            return "critical"
        if any(v.severity == "high" for v in vulns) or any(d.severity == "high" for d in deps):
            return "high"
        if vulns or deps:
            return "medium"
        return "low"

    def _generate_recommendations(
        self,
        secrets: List[SecretFinding],
        vulns: List[VulnerabilityFinding],
        deps: List[DependencyVulnerability],
    ) -> List[str]:
        recs: List[str] = []
        if secrets:
            recs.append("Rotate all exposed secrets immediately and remove them from version control history using git-filter-repo.")
            recs.append("Use a secrets manager (AWS Secrets Manager, HashiCorp Vault, or environment variables).")
        if vulns:
            recs.append("Fix SQL injection vulnerabilities by using parameterized queries exclusively.")
            recs.append("Sanitize all user input before rendering in HTML to prevent XSS.")
        if deps:
            recs.append("Run `pip install --upgrade <package>` for vulnerable dependencies.")
            recs.append("Set up automated dependency scanning in CI/CD (Dependabot, Snyk).")
        if not (secrets or vulns or deps):
            recs.append("No critical issues found. Continue regular security reviews.")
        return recs

    def _generate_summary(
        self,
        secrets: List[SecretFinding],
        vulns: List[VulnerabilityFinding],
        deps: List[DependencyVulnerability],
        severity: str,
    ) -> str:
        total = len(secrets) + len(vulns) + len(deps)
        if total == 0:
            return "✅ Security scan complete. No vulnerabilities detected."
        return (
            f"⚠️ Security scan found {total} issue(s): "
            f"{len(secrets)} secret(s), {len(vulns)} code vulnerability/ies, "
            f"{len(deps)} dependency issue(s). Overall severity: {severity.upper()}."
        )
