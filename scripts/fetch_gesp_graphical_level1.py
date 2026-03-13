#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import List, Optional
from urllib.parse import urljoin
from urllib.request import Request, urlopen

try:
    from pypdf import PdfReader
except Exception:  # pragma: no cover - runtime dependency check
    PdfReader = None


INDEX_URL = "https://gesp.ccf.org.cn/101/1010/index.html"
DEFAULT_OUTPUT = Path("tmp/gesp_graphical_level1_test")
USER_AGENT = "Mozilla/5.0 (Codex GESP Fetcher)"


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: List[tuple[str, str]] = []
        self._href: Optional[str] = None
        self._text: List[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, Optional[str]]]) -> None:
        if tag == "a":
            attr_map = dict(attrs)
            self._href = attr_map.get("href")
            self._text = []

    def handle_data(self, data: str) -> None:
        if self._href is not None:
            self._text.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "a" and self._href is not None:
            text = "".join(self._text).strip()
            if text:
                self.links.append((text, self._href))
            self._href = None
            self._text = []


@dataclass
class MonthEntry:
    title: str
    page_url: str
    month_key: str


def fetch_text(url: str) -> str:
    req = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(req) as resp:
        return resp.read().decode("utf-8", "ignore")


def fetch_bytes(url: str) -> bytes:
    req = Request(url, headers={"User-Agent": USER_AGENT})
    with urlopen(req) as resp:
        return resp.read()


def parse_links(html: str, base_url: str) -> list[tuple[str, str]]:
    parser = LinkParser()
    parser.feed(html)
    return [(text, urljoin(base_url, href)) for text, href in parser.links]


def normalize_space(text: str) -> str:
    return re.sub(r"\s+", "", text)


def parse_month_entries() -> list[MonthEntry]:
    html = fetch_text(INDEX_URL)
    links = parse_links(html, INDEX_URL)
    entries: list[MonthEntry] = []
    seen: set[str] = set()
    for title, url in links:
        compact = normalize_space(title)
        if "GESP" not in compact or "认证真题" not in compact:
            continue
        month_match = re.search(r"(20\d{2})年(\d{1,2})月", compact)
        if not month_match:
            continue
        month_key = f"{month_match.group(1)}-{int(month_match.group(2)):02d}"
        if month_key in seen:
            continue
        seen.add(month_key)
        entries.append(MonthEntry(title=compact, page_url=url, month_key=month_key))
    return entries


def find_graphical_level1_pdf(page_url: str) -> tuple[str, str]:
    html = fetch_text(page_url)
    links = parse_links(html, page_url)
    for text, url in links:
        compact = normalize_space(text)
        if "图形化编程" in compact and ("1级" in compact or "一级" in compact):
            return compact, url
    raise RuntimeError("未找到图形化编程一级 PDF 链接")


def extract_pdf_text(pdf_path: Path) -> str:
    if PdfReader is None:
        raise RuntimeError("缺少 pypdf，请先执行: python3 -m pip install --user pypdf")
    reader = PdfReader(str(pdf_path))
    parts: list[str] = []
    for page in reader.pages:
        parts.append(page.extract_text() or "")
    return "\n".join(parts)


def extract_programming_section(full_text: str) -> tuple[str, str, str]:
    full_text = full_text.replace("\r\n", "\n").replace("\r", "\n")
    start_match = re.search(r"三、编程题", full_text)
    if not start_match:
        raise RuntimeError("PDF 中未找到“三、编程题”段落")
    section = full_text[start_match.start():].strip()

    one_match = re.search(r"(?:^|\n)\s*1、", section)
    two_match = re.search(r"(?:^|\n)\s*2、", section)
    if not one_match or not two_match:
        raise RuntimeError("未能在编程题段落中切分出两道题")
    if two_match.start() <= one_match.start():
        raise RuntimeError("两道编程题的切分顺序异常")

    problem_1 = section[one_match.start():two_match.start()].strip()
    problem_2 = section[two_match.start():].strip()
    return section, problem_1, problem_2


def write_text(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="抓取 GESP 月度图形化编程一级 PDF，并提取两道编程题。")
    parser.add_argument("--limit", type=int, default=3, help="只处理前 N 个月，默认 3")
    parser.add_argument("--offset", type=int, default=0, help="跳过前 N 个月")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT), help="本地输出目录")
    parser.add_argument("--force", action="store_true", help="覆盖已有输出")
    args = parser.parse_args()

    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    months = parse_month_entries()
    selected = months[args.offset: args.offset + args.limit]
    report: list[dict[str, object]] = []

    for month in selected:
        month_dir = output_dir / month.month_key
        result: dict[str, object] = {
            "month": month.month_key,
            "title": month.title,
            "pageUrl": month.page_url,
            "status": "pending",
        }
        try:
            if month_dir.exists() and not args.force:
                raise RuntimeError(f"输出目录已存在：{month_dir}")

            month_dir.mkdir(parents=True, exist_ok=True)
            link_text, pdf_url = find_graphical_level1_pdf(month.page_url)
            pdf_path = month_dir / "graphical_level1.pdf"
            pdf_path.write_bytes(fetch_bytes(pdf_url))

            full_text = extract_pdf_text(pdf_path)
            section, problem_1, problem_2 = extract_programming_section(full_text)

            write_text(month_dir / "full_text.txt", full_text)
            write_text(month_dir / "programming_section.txt", section)
            write_text(month_dir / "problem_1.txt", problem_1)
            write_text(month_dir / "problem_2.txt", problem_2)

            manifest = {
                "month": month.month_key,
                "title": month.title,
                "pageUrl": month.page_url,
                "pdfLinkText": link_text,
                "pdfUrl": pdf_url,
                "files": {
                    "pdf": str(pdf_path.relative_to(output_dir)),
                    "fullText": str((month_dir / "full_text.txt").relative_to(output_dir)),
                    "programmingSection": str((month_dir / "programming_section.txt").relative_to(output_dir)),
                    "problem1": str((month_dir / "problem_1.txt").relative_to(output_dir)),
                    "problem2": str((month_dir / "problem_2.txt").relative_to(output_dir)),
                },
            }
            write_text(month_dir / "manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))

            result.update(
                {
                    "status": "ok",
                    "pdfUrl": pdf_url,
                    "pdfLinkText": link_text,
                    "outputDir": str(month_dir),
                    "problem1Chars": len(problem_1),
                    "problem2Chars": len(problem_2),
                }
            )
        except Exception as exc:  # pragma: no cover - batch script should continue
            result.update({"status": "error", "error": str(exc)})
        report.append(result)

    report_path = output_dir / "_report.json"
    write_text(report_path, json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps({"outputDir": str(output_dir), "processed": len(report), "report": str(report_path)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
