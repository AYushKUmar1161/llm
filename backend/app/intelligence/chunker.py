from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.intelligence.ast_parser import CodeSymbol

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Data class
# ---------------------------------------------------------------------------


@dataclass
class CodeChunk:
    content: str
    file_path: str
    start_line: int
    end_line: int
    chunk_type: str  # function | class | method | module | sliding_window
    symbol_name: Optional[str] = None
    language: str = "unknown"
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def chunk_id(self) -> str:
        """Stable ID for deduplication / upsert."""
        return f"{self.file_path}:{self.start_line}-{self.end_line}"

    def token_estimate(self) -> int:
        """Rough token count — 4 chars ≈ 1 token."""
        return max(1, len(self.content) // 4)


# ---------------------------------------------------------------------------
# Chunker
# ---------------------------------------------------------------------------

_DEFAULT_CHUNK_SIZE = 1000  # tokens
_DEFAULT_OVERLAP = 200  # tokens
_CHARS_PER_TOKEN = 4


class ASTAwareChunker:
    """
    Chunks source files at AST symbol boundaries where possible.
    Falls back to a sliding-window strategy for unsupported languages or
    files with no detected symbols.
    """

    def __init__(
        self,
        chunk_size: int = _DEFAULT_CHUNK_SIZE,
        overlap: int = _DEFAULT_OVERLAP,
    ) -> None:
        self.chunk_size = chunk_size
        self.overlap = overlap
        self._chunk_chars = chunk_size * _CHARS_PER_TOKEN
        self._overlap_chars = overlap * _CHARS_PER_TOKEN

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def chunk_file(
        self,
        file_path: str,
        content: str,
        symbols: List[CodeSymbol],
    ) -> List[CodeChunk]:
        if not content.strip():
            return []

        lines = content.splitlines(keepends=True)
        language = self._detect_language(file_path)
        header = self._build_file_header(file_path, language, len(lines))

        # Filter to substantial symbols (classes, functions, methods)
        structural = [
            s for s in symbols
            if s.symbol_type in ("class", "function", "method", "interface")
            and s.end_line > s.start_line
        ]

        if structural:
            return self._chunk_by_symbols(content, lines, structural, file_path, language, header)
        else:
            return self._sliding_window(content, lines, file_path, language, header)

    # ------------------------------------------------------------------
    # Symbol-based chunking
    # ------------------------------------------------------------------

    def _chunk_by_symbols(
        self,
        content: str,
        lines: List[str],
        symbols: List[CodeSymbol],
        file_path: str,
        language: str,
        header: str,
    ) -> List[CodeChunk]:
        chunks: List[CodeChunk] = []

        # Sort symbols by start line
        symbols_sorted = sorted(symbols, key=lambda s: s.start_line)

        # Collect line ranges occupied by top-level symbols
        covered_ranges: List[tuple[int, int, CodeSymbol]] = []
        for sym in symbols_sorted:
            # Avoid nesting: skip if already covered by a parent
            already_covered = any(
                r[0] <= sym.start_line and sym.end_line <= r[1]
                for r in covered_ranges
            )
            if not already_covered:
                covered_ranges.append((sym.start_line, sym.end_line, sym))

        # Leading content before first symbol
        if covered_ranges and covered_ranges[0][0] > 1:
            preamble = "".join(lines[: covered_ranges[0][0] - 1])
            if preamble.strip():
                chunks.append(
                    CodeChunk(
                        content=header + preamble,
                        file_path=file_path,
                        start_line=1,
                        end_line=covered_ranges[0][0] - 1,
                        chunk_type="module",
                        language=language,
                    )
                )

        for start, end, sym in covered_ranges:
            symbol_content = "".join(lines[start - 1 : end])
            # If the symbol itself is too large, split it with sliding window
            if len(symbol_content) > self._chunk_chars * 2:
                sub_chunks = self._sliding_window(
                    symbol_content,
                    symbol_content.splitlines(keepends=True),
                    file_path,
                    language,
                    header,
                    line_offset=start - 1,
                )
                # Override chunk_type/symbol_name for sub-chunks
                for sc in sub_chunks:
                    sc.chunk_type = sym.symbol_type
                    sc.symbol_name = sym.name
                chunks.extend(sub_chunks)
            else:
                chunks.append(
                    CodeChunk(
                        content=header + symbol_content,
                        file_path=file_path,
                        start_line=start,
                        end_line=end,
                        chunk_type=sym.symbol_type,
                        symbol_name=sym.name,
                        language=language,
                        metadata={
                            "docstring": sym.docstring,
                            "parameters": sym.parameters,
                            "return_type": sym.return_type,
                            "decorators": sym.decorators,
                            "complexity": sym.complexity,
                        },
                    )
                )

        # Trailing content after last symbol
        if covered_ranges and covered_ranges[-1][1] < len(lines):
            trailer = "".join(lines[covered_ranges[-1][1] :])
            if trailer.strip():
                chunks.append(
                    CodeChunk(
                        content=header + trailer,
                        file_path=file_path,
                        start_line=covered_ranges[-1][1] + 1,
                        end_line=len(lines),
                        chunk_type="module",
                        language=language,
                    )
                )

        return chunks

    # ------------------------------------------------------------------
    # Sliding-window fallback
    # ------------------------------------------------------------------

    def _sliding_window(
        self,
        content: str,
        lines: List[str],
        file_path: str,
        language: str,
        header: str,
        line_offset: int = 0,
    ) -> List[CodeChunk]:
        chunks: List[CodeChunk] = []
        pos = 0
        total_chars = len(content)
        chunk_chars = self._chunk_chars - len(header)

        while pos < total_chars:
            end = min(pos + chunk_chars, total_chars)
            # Snap to next newline so we don't cut mid-line
            if end < total_chars:
                newline_pos = content.rfind("\n", pos, end)
                if newline_pos > pos:
                    end = newline_pos + 1

            snippet = content[pos:end]
            start_line = line_offset + content[:pos].count("\n") + 1
            end_line = line_offset + content[:end].count("\n")

            chunks.append(
                CodeChunk(
                    content=header + snippet,
                    file_path=file_path,
                    start_line=start_line,
                    end_line=end_line,
                    chunk_type="sliding_window",
                    language=language,
                )
            )

            # Move forward with overlap
            step = chunk_chars - self._overlap_chars
            pos += max(step, 1)

        return chunks

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _build_file_header(self, file_path: str, language: str, total_lines: int) -> str:
        return (
            f"# File: {file_path}\n"
            f"# Language: {language}\n"
            f"# Lines: {total_lines}\n\n"
        )

    def _detect_language(self, file_path: str) -> str:
        from app.intelligence.ast_parser import ASTParser
        return ASTParser().detect_language(file_path)
