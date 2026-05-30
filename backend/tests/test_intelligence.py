from __future__ import annotations

import unittest
from app.intelligence.ast_parser import ASTParser, CodeSymbol
from app.intelligence.chunker import ASTAwareChunker


class TestASTParser(unittest.TestCase):
    def setUp(self):
        self.parser = ASTParser()

    def test_detect_language_python(self):
        self.assertEqual(self.parser.detect_language("test.py"), "python")
        self.assertEqual(self.parser.detect_language("path/to/test.py"), "python")

    def test_detect_language_javascript(self):
        self.assertEqual(self.parser.detect_language("test.js"), "javascript")
        self.assertEqual(self.parser.detect_language("test.jsx"), "javascript")

    def test_detect_language_typescript(self):
        self.assertEqual(self.parser.detect_language("test.ts"), "typescript")
        self.assertEqual(self.parser.detect_language("test.tsx"), "typescript")

    def test_parse_python_snippet(self):
        content = """
class DataModel:
    def __init__(self, value: int):
        self.value = value

    def compute(self) -> int:
        return self.value * 2

def helper_function(x):
    return x + 1
"""
        symbols = self.parser.parse_file("model.py", content)
        class_symbols = [s for s in symbols if s.symbol_type == "class"]
        func_symbols = [s for s in symbols if s.symbol_type in ("function", "method")]

        self.assertEqual(len(class_symbols), 1)
        self.assertEqual(class_symbols[0].name, "DataModel")

        self.assertEqual(len(func_symbols), 3)  # __init__, compute, helper_function
        self.assertIn("helper_function", [s.name for s in func_symbols])


class TestASTAwareChunker(unittest.TestCase):
    def setUp(self):
        self.chunker = ASTAwareChunker(chunk_size=100, overlap=10)
        self.parser = ASTParser()

    def test_chunk_file_fallback(self):
        content = "word " * 200
        # No symbols
        chunks = self.chunker.chunk_file("test.txt", content, [])
        self.assertTrue(len(chunks) > 1)
        for chunk in chunks:
            self.assertEqual(chunk.file_path, "test.txt")

    def test_chunk_file_with_symbols(self):
        content = """
class DataModel:
    def __init__(self, value: int):
        self.value = value

    def compute(self) -> int:
        return self.value * 2
"""
        symbols = self.parser.parse_file("model.py", content)
        chunks = self.chunker.chunk_file("model.py", content, symbols)

        self.assertTrue(len(chunks) >= 1)
        for chunk in chunks:
            self.assertEqual(chunk.file_path, "model.py")
            # Should have captured class or function symbol details
            self.assertTrue(chunk.symbol_name in ("DataModel", "__init__", "compute", "model.py"))


if __name__ == "__main__":
    unittest.main()
