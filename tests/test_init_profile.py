"""Profile initialization must preserve existing personal files."""

import tempfile
import unittest
from pathlib import Path

from tools.init_profile import initialize


class InitializeProfileTests(unittest.TestCase):
    def test_creates_missing_files_without_overwriting_existing_data(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            seeds, workspace = root / "seeds", root / "workspace"
            (seeds / "nested").mkdir(parents=True)
            workspace.mkdir()
            (seeds / "CLAUDE.md").write_text("[YOUR_NAME]", encoding="utf-8")
            (seeds / "nested" / "profile.md").write_text("姓名: [NAME]", encoding="utf-8")
            (workspace / "CLAUDE.md").write_text("Existing personal data", encoding="utf-8")

            self.assertEqual(initialize(seeds, workspace), ["nested/profile.md"])
            self.assertEqual((workspace / "CLAUDE.md").read_text(), "Existing personal data")
            self.assertEqual((workspace / "nested" / "profile.md").read_text(), "姓名: [NAME]")
            self.assertEqual(initialize(seeds, workspace), [])


if __name__ == "__main__":
    unittest.main()
