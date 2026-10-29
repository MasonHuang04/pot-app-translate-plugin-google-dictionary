"""Create Pot's ZIP-based .potext package using only the Python standard library."""
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[1]
info = json.loads((root / "info.json").read_text(encoding="utf-8"))
assert info["id"].startswith("plugin.")
assert info["plugin_type"] == "translate"
files = ["main.js", "info.json", info["icon"], "LICENSE"]
assert all((root / name).is_file() for name in files)
destination = root / "dist" / (info["id"] + ".potext")
destination.parent.mkdir(exist_ok=True)
with ZipFile(destination, "w", ZIP_DEFLATED) as package:
    for name in files:
        package.write(root / name, name)
with ZipFile(destination) as package:
    assert package.testzip() is None
    assert set(package.namelist()) == set(files)
print(destination)
