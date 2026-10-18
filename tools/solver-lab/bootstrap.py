"""Install pinned research tools privately; never change the user's global environment."""
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tomllib
import urllib.request

PRIMARY = "5fc7ee3d92b823b6c58e4f58cbee7d50d5e9e6de"
REFERENCE = "9d1509fe5077d019825f833eed04b16d342dfda1"
ROOT = Path(os.environ.get("POKER_SOLVER_LAB", str(Path(Path(__file__).resolve().anchor) / "PokerResearch/2026-10-16-solutions")))


def fetch(url, destination, expected=None):
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.exists() or (expected and digest(destination) != expected):
        temporary = destination.with_suffix(destination.suffix + ".part")
        with urllib.request.urlopen(url, timeout=90) as response, temporary.open("wb") as out:
            shutil.copyfileobj(response, out)
        temporary.replace(destination)
    actual = digest(destination)
    if expected and actual != expected:
        raise ValueError(f"Checksum mismatch: {destination.name}")
    return {"url": url, "sha256": actual, "file": destination.name}


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def environment():
    env = dict(os.environ)
    (ROOT / "tmp").mkdir(parents=True, exist_ok=True)
    env.update(CARGO_HOME=str(ROOT / "cargo-home"), CARGO_TARGET_DIR=str(ROOT / "target"))
    env.update(TEMP=str(ROOT / "tmp"), TMP=str(ROOT / "tmp"))
    env["PATH"] = os.pathsep.join([str(ROOT / "rust/bin"), str(ROOT / "w64devkit/bin"), env["PATH"]])
    # Native GNU host: apply flags to build scripts as well as target crates.
    env.pop("CARGO_BUILD_TARGET", None)
    env["RUSTFLAGS"] = "-C link-self-contained=yes"
    env["RUSTC"] = str(ROOT / "rust/bin/rustc.exe")
    env["CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER"] = str(ROOT / "w64devkit/bin/gcc.exe")
    return env


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    manifest_url = "https://static.rust-lang.org/dist/channel-rust-1.99.1.toml"
    checksum = urllib.request.urlopen(manifest_url + ".sha256", timeout=60).read().decode().split()[0]
    manifest_path = ROOT / "rust-manifest.txt"
    records = [fetch(manifest_url, manifest_path, checksum)]
    manifest = tomllib.loads(manifest_path.read_text())
    jobs = []
    for package in ["rustc", "cargo", "rust-std", "rust-mingw"]:
        entry = manifest["pkg"][package]["target"]["x86_64-pc-windows-gnu"]
        jobs.append((entry["xz_url"], ROOT / entry["xz_url"].rsplit("/", 1)[1], entry["xz_hash"]))
    # Digest from the official release asset metadata; checked before extraction.
    jobs.append(("https://github.com/skeeto/w64devkit/releases/download/v2.10.1/w64devkit-x64-2.10.1.7z.exe",
                 ROOT / "w64devkit-x64-2.10.1.7z.exe", "add1edf984ce4d473cfeb7c52e0ab38db73a855bba6c7f564d5e16648eb2896a"))
    with concurrent.futures.ThreadPoolExecutor() as pool:
        records.extend(pool.map(lambda args: fetch(*args), jobs))
    for archive in [job[1] for job in jobs[:4]]:
        with tarfile.open(archive) as source:
            source.extractall(ROOT / "unpacked", filter="data")
        base = ROOT / "unpacked" / archive.name.removesuffix(".tar.xz")
        for component in (base / "components").read_text().splitlines():
            shutil.copytree(base / component, ROOT / "rust", dirs_exist_ok=True)
    if not (ROOT / "w64devkit/bin/gcc.exe").exists():
        subprocess.run([str(jobs[4][1]), "-y", f"-o{ROOT}"], check=True, cwd=ROOT, stdout=subprocess.DEVNULL)
    for repo, revision in [("ucsandman/postflop", PRIMARY), ("b-inary/postflop-solver", REFERENCE)]:
        archive = ROOT / (repo.split("/")[1] + ".tar.gz")
        records.append(fetch(f"https://codeload.github.com/{repo}/tar.gz/{revision}", archive))
        with tarfile.open(archive) as source:
            source.extractall(ROOT / "sources", filter="data")
    (ROOT / "downloads.json").write_text(json.dumps(records, indent=2), encoding="utf-8")
    for command in [[str(ROOT / "rust/bin/rustc.exe"), "--version"], [str(ROOT / "rust/bin/cargo.exe"), "--version"], [str(ROOT / "w64devkit/bin/gcc.exe"), "--version"]]:
        subprocess.run(command, env=environment(), check=True)
    print(f"Private research environment ready: {ROOT}")


if __name__ == "__main__":
    main()
