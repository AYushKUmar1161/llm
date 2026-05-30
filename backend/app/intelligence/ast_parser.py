from __future__ import annotations

import ast
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Tree-Sitter dynamic setup with offline fallback
_HAS_TREE_SITTER = False
try:
    from tree_sitter import Language, Parser
    import tree_sitter_javascript
    import tree_sitter_typescript
    _HAS_TREE_SITTER = True
except Exception as _e:
    logger.debug("Tree-Sitter dynamic import fallback active: %s", _e)

# ---------------------------------------------------------------------------
# Data class
# ---------------------------------------------------------------------------


@dataclass
class CodeSymbol:
    name: str
    symbol_type: str  # class|function|method|interface|import|export
    file_path: str
    start_line: int
    end_line: int
    language: str
    docstring: Optional[str] = None
    parameters: List[str] = field(default_factory=list)
    return_type: Optional[str] = None
    decorators: List[str] = field(default_factory=list)
    complexity: int = 1  # cyclomatic complexity estimate
    metadata: Dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Language detection
# ---------------------------------------------------------------------------

_EXTENSION_MAP: Dict[str, str] = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".mjs": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".java": "java",
    ".kt": "kotlin",
    ".go": "go",
    ".rs": "rust",
    ".rb": "ruby",
    ".php": "php",
    ".cs": "csharp",
    ".cpp": "cpp",
    ".c": "c",
    ".h": "c",
    ".hpp": "cpp",
    ".swift": "swift",
    ".scala": "scala",
    ".sh": "shell",
    ".bash": "shell",
    ".zsh": "shell",
    ".md": "markdown",
    ".json": "json",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".sql": "sql",
    ".html": "html",
    ".css": "css",
    ".scss": "scss",
}


# ---------------------------------------------------------------------------
# Main parser
# ---------------------------------------------------------------------------


class ASTParser:
    """
    Multi-language AST/regex parser that extracts code symbols (classes,
    functions, methods, imports) from source files.
    """

    def detect_language(self, file_path: str) -> str:
        suffix = Path(file_path).suffix.lower()
        return _EXTENSION_MAP.get(suffix, "unknown")

    def parse_file(self, file_path: str, content: str) -> List[CodeSymbol]:
        language = self.detect_language(file_path)
        try:
            if language == "python":
                return self.parse_python(content, file_path)
            elif language in ("javascript",):
                return self.parse_javascript(content, file_path)
            elif language in ("typescript",):
                return self.parse_typescript(content, file_path)
            elif language == "java":
                return self.parse_java(content, file_path)
            else:
                return []
        except Exception as exc:
            logger.warning("Failed to parse %s: %s", file_path, exc)
            return []

    # ------------------------------------------------------------------
    # Python (uses stdlib ast)
    # ------------------------------------------------------------------

    def parse_python(self, content: str, file_path: str) -> List[CodeSymbol]:
        symbols: List[CodeSymbol] = []
        try:
            tree = ast.parse(content)
        except SyntaxError as exc:
            logger.debug("Python syntax error in %s: %s", file_path, exc)
            return symbols

        lines = content.splitlines()

        for node in ast.walk(tree):
            if isinstance(node, (ast.ClassDef,)):
                symbols.append(self._python_class(node, file_path, lines))
                # Extract methods
                for item in node.body:
                    if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                        sym = self._python_func(item, file_path, lines, parent_class=node.name)
                        sym.symbol_type = "method"
                        symbols.append(sym)

            elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                # Only top-level functions (not methods — those handled above)
                parent = None
                for candidate in ast.walk(tree):
                    if isinstance(candidate, ast.ClassDef) and node in ast.walk(candidate):
                        parent = candidate
                        break
                if parent is None:
                    symbols.append(self._python_func(node, file_path, lines))

            elif isinstance(node, ast.Import):
                for alias in node.names:
                    symbols.append(
                        CodeSymbol(
                            name=alias.asname or alias.name,
                            symbol_type="import",
                            file_path=file_path,
                            start_line=node.lineno,
                            end_line=node.lineno,
                            language="python",
                            metadata={"module": alias.name},
                        )
                    )

            elif isinstance(node, ast.ImportFrom):
                module = node.module or ""
                for alias in node.names:
                    symbols.append(
                        CodeSymbol(
                            name=alias.asname or alias.name,
                            symbol_type="import",
                            file_path=file_path,
                            start_line=node.lineno,
                            end_line=node.lineno,
                            language="python",
                            metadata={"module": module, "from_import": True},
                        )
                    )

        return symbols

    def _python_class(self, node: ast.ClassDef, file_path: str, lines: List[str]) -> CodeSymbol:
        docstring = ast.get_docstring(node)
        decorators = [ast.unparse(d) for d in node.decorator_list]
        end_line = getattr(node, "end_lineno", node.lineno)
        complexity = self._estimate_complexity_python(node)
        return CodeSymbol(
            name=node.name,
            symbol_type="class",
            file_path=file_path,
            start_line=node.lineno,
            end_line=end_line,
            language="python",
            docstring=docstring,
            decorators=decorators,
            complexity=complexity,
            metadata={"bases": [ast.unparse(b) for b in node.bases]},
        )

    def _python_func(
        self,
        node: ast.FunctionDef | ast.AsyncFunctionDef,
        file_path: str,
        lines: List[str],
        parent_class: Optional[str] = None,
    ) -> CodeSymbol:
        docstring = ast.get_docstring(node)
        decorators = [ast.unparse(d) for d in node.decorator_list]
        end_line = getattr(node, "end_lineno", node.lineno)
        params = self._python_params(node)
        return_type = ast.unparse(node.returns) if node.returns else None
        complexity = self._estimate_complexity_python(node)
        is_async = isinstance(node, ast.AsyncFunctionDef)
        return CodeSymbol(
            name=node.name,
            symbol_type="function",
            file_path=file_path,
            start_line=node.lineno,
            end_line=end_line,
            language="python",
            docstring=docstring,
            parameters=params,
            return_type=return_type,
            decorators=decorators,
            complexity=complexity,
            metadata={"is_async": is_async, "parent_class": parent_class},
        )

    def _python_params(self, node: ast.FunctionDef | ast.AsyncFunctionDef) -> List[str]:
        args = node.args
        params = []
        for arg in args.args:
            annotation = f": {ast.unparse(arg.annotation)}" if arg.annotation else ""
            params.append(f"{arg.arg}{annotation}")
        if args.vararg:
            params.append(f"*{args.vararg.arg}")
        for arg in args.kwonlyargs:
            params.append(arg.arg)
        if args.kwarg:
            params.append(f"**{args.kwarg.arg}")
        return params

    def _estimate_complexity_python(self, node: ast.AST) -> int:
        """Very rough cyclomatic complexity estimate: 1 + branches."""
        complexity = 1
        for child in ast.walk(node):
            if isinstance(child, (ast.If, ast.While, ast.For, ast.ExceptHandler,
                                   ast.With, ast.Assert, ast.comprehension)):
                complexity += 1
            elif isinstance(child, ast.BoolOp):
                complexity += len(child.values) - 1
        return complexity

    # ------------------------------------------------------------------
    # JavaScript (High-Fidelity Tree-Sitter with regex fallback)
    # ------------------------------------------------------------------

    def parse_javascript(self, content: str, file_path: str) -> List[CodeSymbol]:
        return self._parse_js_ts(content, file_path, language="javascript")

    def parse_typescript(self, content: str, file_path: str) -> List[CodeSymbol]:
        return self._parse_js_ts(content, file_path, language="typescript")

    def _parse_js_ts_treesitter(self, content: str, file_path: str, language: str) -> List[CodeSymbol]:
        if not _HAS_TREE_SITTER:
            return []
        try:
            if language == "javascript":
                lang = Language(tree_sitter_javascript.language())
            elif language == "typescript":
                lang = Language(tree_sitter_typescript.language())
            else:
                return []
            
            parser = Parser(lang)
            tree = parser.parse(bytes(content, "utf8"))
            symbols: List[CodeSymbol] = []

            def traverse(node):
                if node.type in ("class_declaration", "interface_declaration", "function_declaration", "method_definition", "arrow_function"):
                    name = ""
                    for child in node.children:
                        if child.type in ("identifier", "property_identifier"):
                            name = content[child.start_byte:child.end_byte]
                            break
                    if name:
                        start_line = node.start_point[0] + 1
                        end_line = node.end_point[0] + 1
                        symbol_type = "function"
                        if node.type == "class_declaration":
                            symbol_type = "class"
                        elif node.type == "interface_declaration":
                            symbol_type = "interface"
                        elif node.type == "method_definition":
                            symbol_type = "method"
                        symbols.append(CodeSymbol(
                            name=name,
                            symbol_type=symbol_type,
                            file_path=file_path,
                            start_line=start_line,
                            end_line=end_line,
                            language=language,
                        ))
                for child in node.children:
                    traverse(child)

            traverse(tree.root_node)
            return symbols
        except Exception as exc:
            logger.debug("Tree-sitter parse failed for %s: %s", file_path, exc)
            return []

    def _parse_js_ts(self, content: str, file_path: str, language: str) -> List[CodeSymbol]:
        # Try high-fidelity Tree-Sitter first
        ts_symbols = self._parse_js_ts_treesitter(content, file_path, language)
        if ts_symbols:
            return ts_symbols

        symbols: List[CodeSymbol] = []
        lines = content.splitlines()

        # Class declarations
        class_re = re.compile(
            r"^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)", re.MULTILINE
        )
        for m in class_re.finditer(content):
            lineno = content[: m.start()].count("\n") + 1
            symbols.append(
                CodeSymbol(
                    name=m.group(1),
                    symbol_type="class",
                    file_path=file_path,
                    start_line=lineno,
                    end_line=lineno,
                    language=language,
                )
            )

        # Interface (TypeScript)
        if language == "typescript":
            iface_re = re.compile(r"^(?:export\s+)?interface\s+(\w+)", re.MULTILINE)
            for m in iface_re.finditer(content):
                lineno = content[: m.start()].count("\n") + 1
                symbols.append(
                    CodeSymbol(
                        name=m.group(1),
                        symbol_type="interface",
                        file_path=file_path,
                        start_line=lineno,
                        end_line=lineno,
                        language=language,
                    )
                )

        # Named function declarations
        func_re = re.compile(
            r"^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)",
            re.MULTILINE,
        )
        for m in func_re.finditer(content):
            lineno = content[: m.start()].count("\n") + 1
            params = [p.strip() for p in m.group(2).split(",") if p.strip()]
            symbols.append(
                CodeSymbol(
                    name=m.group(1),
                    symbol_type="function",
                    file_path=file_path,
                    start_line=lineno,
                    end_line=lineno,
                    language=language,
                    parameters=params,
                )
            )

        # Arrow functions assigned to const/let/var
        arrow_re = re.compile(
            r"^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>",
            re.MULTILINE,
        )
        for m in arrow_re.finditer(content):
            lineno = content[: m.start()].count("\n") + 1
            params = [p.strip() for p in m.group(2).split(",") if p.strip()]
            symbols.append(
                CodeSymbol(
                    name=m.group(1),
                    symbol_type="function",
                    file_path=file_path,
                    start_line=lineno,
                    end_line=lineno,
                    language=language,
                    parameters=params,
                    metadata={"is_arrow": True},
                )
            )

        # Imports
        import_re = re.compile(
            r"^import\s+(?:\{[^}]*\}|\w+|\*\s+as\s+\w+)\s+from\s+['\"]([^'\"]+)['\"]",
            re.MULTILINE,
        )
        for m in import_re.finditer(content):
            lineno = content[: m.start()].count("\n") + 1
            symbols.append(
                CodeSymbol(
                    name=m.group(1),
                    symbol_type="import",
                    file_path=file_path,
                    start_line=lineno,
                    end_line=lineno,
                    language=language,
                    metadata={"module": m.group(1)},
                )
            )

        return symbols

    # ------------------------------------------------------------------
    # Java (regex-based)
    # ------------------------------------------------------------------

    def parse_java(self, content: str, file_path: str) -> List[CodeSymbol]:
        symbols: List[CodeSymbol] = []

        # Class / interface / enum
        class_re = re.compile(
            r"^(?:public\s+|private\s+|protected\s+|abstract\s+|final\s+)*"
            r"(?:class|interface|enum)\s+(\w+)",
            re.MULTILINE,
        )
        for m in class_re.finditer(content):
            lineno = content[: m.start()].count("\n") + 1
            symbols.append(
                CodeSymbol(
                    name=m.group(1),
                    symbol_type="class",
                    file_path=file_path,
                    start_line=lineno,
                    end_line=lineno,
                    language="java",
                )
            )

        # Methods
        method_re = re.compile(
            r"^\s+(?:public|private|protected|static|final|abstract|synchronized|native|strictfp|\s)+"
            r"[\w<>\[\]]+\s+(\w+)\s*\(([^)]*)\)",
            re.MULTILINE,
        )
        for m in method_re.finditer(content):
            lineno = content[: m.start()].count("\n") + 1
            params = [p.strip() for p in m.group(2).split(",") if p.strip()]
            symbols.append(
                CodeSymbol(
                    name=m.group(1),
                    symbol_type="method",
                    file_path=file_path,
                    start_line=lineno,
                    end_line=lineno,
                    language="java",
                    parameters=params,
                )
            )

        # Imports
        import_re = re.compile(r"^import\s+([\w.]+);", re.MULTILINE)
        for m in import_re.finditer(content):
            lineno = content[: m.start()].count("\n") + 1
            symbols.append(
                CodeSymbol(
                    name=m.group(1).split(".")[-1],
                    symbol_type="import",
                    file_path=file_path,
                    start_line=lineno,
                    end_line=lineno,
                    language="java",
                    metadata={"module": m.group(1)},
                )
            )

        return symbols

    # ------------------------------------------------------------------
    # Utility
    # ------------------------------------------------------------------

    def get_imports(self, content: str, language: str) -> List[str]:
        """Return list of imported module names for the given language."""
        if language == "python":
            try:
                tree = ast.parse(content)
                imports = []
                for node in ast.walk(tree):
                    if isinstance(node, ast.Import):
                        imports.extend(a.name for a in node.names)
                    elif isinstance(node, ast.ImportFrom):
                        if node.module:
                            imports.append(node.module)
                return imports
            except SyntaxError:
                return []
        elif language in ("javascript", "typescript"):
            import_re = re.compile(
                r"from\s+['\"]([^'\"]+)['\"]", re.MULTILINE
            )
            return import_re.findall(content)
        elif language == "java":
            import_re = re.compile(r"^import\s+([\w.]+);", re.MULTILINE)
            return import_re.findall(content)
        return []
