#!/usr/bin/env python3
"""정적 자료 페이지 빌드: docs/ 의 원본을 frontend/public/docs/ 의 완성 HTML 로 만든다.

사용: python tools/build_docs.py
입력
  docs/견적.md                          → /docs/estimate.html   (markdown → HTML, 목차 포함)
  docs/site/estimate-brief.fragment.html → /docs/estimate-brief.html (Artifact 조각을 완전한 문서로 감싼다)
출력은 커밋해서 Docker 빌드에 Python 이 필요 없게 한다.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import markdown

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend" / "public" / "docs"
NL = chr(10)

# ---------------------------------------------------------------------------
# 사이트 공통 메뉴 (React 앱과 같은 색·글꼴 계열)
# ---------------------------------------------------------------------------
NAV_LINKS = [
    ("/", "홈"),
    ("/docs/", "자료"),
    ("/docs/estimate-brief.html", "견적 브리프"),
    ("/docs/estimate.html", "견적 상세"),
    ("/login", "로그인"),
]

NAV_CSS = """
.site-nav{position:sticky;top:0;z-index:100;background:#0b1b34;color:#fff;font-family:"Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;border-bottom:1px solid rgba(255,255,255,.08)}
.site-nav .in{max-width:1040px;margin:0 auto;display:flex;align-items:center;gap:14px;padding:0 16px;height:54px}
.site-nav .brand{display:inline-flex;align-items:center;gap:8px;color:#fff;text-decoration:none;font-weight:700;font-size:15px;white-space:nowrap}
.site-nav .brand b{color:#f5b544}
.site-nav .brand svg{width:22px;height:22px;color:#f5b544}
.site-nav nav{display:flex;gap:2px;overflow-x:auto;scrollbar-width:none;margin-left:auto}
.site-nav nav::-webkit-scrollbar{display:none}
.site-nav nav a{color:#e2e8f0;text-decoration:none;font-size:13.5px;font-weight:600;padding:8px 10px;border-radius:8px;white-space:nowrap}
.site-nav nav a:hover{background:rgba(255,255,255,.08)}
.site-nav nav a.on{background:rgba(245,181,68,.18);color:#f5b544}
.site-foot{max-width:1040px;margin:0 auto;padding:22px 16px 34px;font-size:12px;color:#64748b;display:flex;flex-wrap:wrap;gap:6px 16px;justify-content:space-between;font-family:"Pretendard Variable",Pretendard,-apple-system,system-ui,sans-serif}
.site-foot a{color:inherit}
@media (max-width:480px){.site-nav .brand span{display:none}}
"""

LOGO = ('<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M4 15.5 16 5l12 10.5" fill="none" stroke="currentColor" stroke-width="2.4" '
        'stroke-linecap="round" stroke-linejoin="round"/><path d="M7.5 13.5V27h17V13.5" fill="none" stroke="currentColor" stroke-width="2.4" '
        'stroke-linejoin="round"/><path d="M11.5 20a6.4 6.4 0 0 1 9 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>'
        '<circle cx="16" cy="25.2" r="1.4" fill="currentColor"/></svg>')

PRETENDARD = ('<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/'
              'pretendardvariable-dynamic-subset.min.css">')


def nav_html(current: str) -> str:
    links = NL.join(
        f'      <a href="{href}"{" class=on" if href == current else ""}>{label}</a>' for href, label in NAV_LINKS
    )
    return (f'<header class="site-nav"><div class="in">{NL}'
            f'    <a class="brand" href="/">{LOGO}<span>Smart Home <b>Option</b></span></a>{NL}'
            f'    <nav aria-label="사이트 메뉴">{NL}{links}{NL}    </nav>{NL}</div></header>')


def foot_html(note: str) -> str:
    return (f'<footer class="site-foot"><span>{note}</span>'
            f'<span><a href="/docs/">자료 목록</a> · <a href="https://github.com/lsaim1004-coder/smarthome-web">GitHub</a></span></footer>')


def page(title: str, head_extra: str, body: str, current: str, note: str, body_class: str = "") -> str:
    return f"""<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>{title}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
{PRETENDARD}
{head_extra}
<style>{NAV_CSS}</style>
</head>
<body{f' class="{body_class}"' if body_class else ''}>
{nav_html(current)}
{body}
{foot_html(note)}
</body>
</html>
"""


# ---------------------------------------------------------------------------
# 1) Artifact 조각 → 완전한 문서
# ---------------------------------------------------------------------------
def wrap_fragment(src: Path, out_name: str, current: str, note: str) -> str:
    frag = src.read_text(encoding="utf-8")
    title = re.search(r"<title>(.*?)</title>", frag, re.S)
    links = re.findall(r"<link[^>]*>", frag)
    style = re.search(r"<style>.*?</style>", frag, re.S)
    body = frag
    for pat in [r"<title>.*?</title>", r"<style>.*?</style>"] + [re.escape(l) for l in links]:
        body = re.sub(pat, "", body, count=1, flags=re.S)
    body = body.strip()
    # 조각의 body 는 padding-inline 만 있고 배경은 body 색 → 그대로 두되 상단 메뉴 아래 여백 확보
    extra = NL.join(links) + NL + (style.group(0) if style else "") + NL + "<style>body{margin:0}</style>"
    html = page(title.group(1) if title else out_name, extra, body, current, note)
    (OUT / out_name).write_text(html, encoding="utf-8", newline=NL)
    return out_name


# ---------------------------------------------------------------------------
# 2) markdown → HTML (견적.md)
# ---------------------------------------------------------------------------
MD_CSS = """
:root{--ink:#0f172a;--ink-2:#334155;--muted:#64748b;--line:#e2e8f0;--bg:#f5f7fb;--card:#fff;--navy:#0b1b34;--amber:#f5b544;--amber-2:#d99a1f}
body{margin:0;background:var(--bg);color:var(--ink);font-family:"Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;line-height:1.7;word-break:keep-all;-webkit-text-size-adjust:100%}
.doc{max-width:1040px;margin:0 auto;padding:28px 16px 40px;display:grid;grid-template-columns:1fr;gap:24px}
.doc-head{background:var(--navy);color:#fff;border-radius:16px;padding:26px 24px}
.doc-head .kicker{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--amber);font-weight:800}
.doc-head h1{margin:6px 0 10px;font-size:clamp(24px,5vw,34px);line-height:1.25;letter-spacing:-.02em}
.doc-head p{margin:0;color:#cbd5e1;font-size:15px}
.toc{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 18px;font-size:14px}
.toc h2{margin:0 0 8px;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--amber-2)}
.toc ul{margin:0;padding-left:18px}.toc li{margin:3px 0}.toc a{color:var(--ink);text-decoration:none}.toc a:hover{text-decoration:underline}
.toc ul ul{padding-left:16px;color:var(--muted)}
article{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:clamp(18px,3vw,34px);box-shadow:0 10px 30px rgba(11,27,52,.06);min-width:0}
article h1{display:none}
article h2{font-size:clamp(20px,3.6vw,26px);letter-spacing:-.02em;margin:44px 0 12px;padding-top:18px;border-top:2px solid var(--navy)}
article h2:first-of-type{margin-top:8px;border-top:0;padding-top:0}
article h3{font-size:17px;margin:30px 0 10px;color:var(--navy)}
article h4{font-size:15px;margin:20px 0 8px}
article p,article li{font-size:15px;color:var(--ink-2)}
article strong{color:var(--ink)}
article a{color:#1d4ed8;text-decoration:none;overflow-wrap:anywhere}article a:hover{text-decoration:underline}
article blockquote{margin:14px 0;padding:12px 16px;background:#fffbeb;border-left:4px solid var(--amber);border-radius:8px;color:var(--ink-2)}
article blockquote p{margin:4px 0}
article hr{border:0;border-top:1px dashed var(--line);margin:32px 0}
article code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.88em;background:#f1f5f9;padding:1px 6px;border-radius:5px;color:var(--ink)}
article pre{background:var(--navy);color:#e2e8f0;padding:14px 16px;border-radius:10px;overflow-x:auto;font-size:13px;line-height:1.55}
article pre code{background:none;color:inherit;padding:0;font-size:inherit}
.tbl{overflow-x:auto;margin:12px 0 18px;border:1px solid var(--line);border-radius:10px}
article table{border-collapse:collapse;width:100%;font-size:13.5px;min-width:560px}
article th,article td{padding:9px 11px;border-bottom:1px solid var(--line);vertical-align:top;text-align:left}
article th{background:#f1f5f9;font-weight:700;white-space:nowrap;position:sticky;top:0}
article tr:last-child td{border-bottom:0}
article td small{color:var(--muted)}
article ul,article ol{padding-left:22px}
.h-anchor{color:var(--line);text-decoration:none;margin-left:6px;font-weight:400}
h2:hover .h-anchor,h3:hover .h-anchor{color:var(--amber-2)}
@media (min-width:960px){.doc{grid-template-columns:240px 1fr;align-items:start}.doc-head{grid-column:1/-1}.toc{position:sticky;top:66px;max-height:calc(100vh - 90px);overflow:auto}}
"""


def build_markdown(src: Path, out_name: str, current: str) -> str:
    text = src.read_text(encoding="utf-8")
    # 첫 줄 제목과 인용 요약 분리
    lines = text.split(NL)
    title = lines[0].lstrip("# ").strip() if lines and lines[0].startswith("# ") else src.stem
    body_md = NL.join(lines[1:]) if lines and lines[0].startswith("# ") else text
    md = markdown.Markdown(extensions=["tables", "fenced_code", "toc", "sane_lists", "attr_list"],
                           extension_configs={"toc": {"toc_depth": "2-3", "permalink": "#", "permalink_class": "h-anchor",
                                                      "permalink_title": "이 절 링크"}})
    html = md.convert(body_md)
    html = re.sub(r"<table>", '<div class="tbl"><table>', html)
    html = re.sub(r"</table>", "</table></div>", html)
    toc = md.toc.replace('<div class="toc">', '<div class="toc-list">')  # type: ignore[attr-defined]
    body = f"""<div class="doc">
  <div class="doc-head"><div class="kicker">Smart Home Option Service · 자료</div><h1>{title}</h1>
  <p>2026-09-11 시장 조사 · 원가 · 판매가 · 사업자 수익. 원문은 저장소 <code>docs/견적.md</code>, 계산은 <code>tools/estimate.py</code>.</p></div>
  <aside class="toc"><h2>목차</h2>{toc}</aside>
  <article>{html}</article>
</div>"""
    out = page(f"{title} · Smart Home Option", f"<style>{MD_CSS}</style>", body, current,
               "가격은 조사 시점(2026-09-11) 값이며 수시로 바뀝니다.")
    (OUT / out_name).write_text(out, encoding="utf-8", newline=NL)
    return out_name


# ---------------------------------------------------------------------------
# 3) 자료 목록 페이지
# ---------------------------------------------------------------------------
INDEX_CSS = """
body{margin:0;background:#f5f7fb;color:#0f172a;font-family:"Pretendard Variable",Pretendard,-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif;line-height:1.6}
.wrap{max-width:1040px;margin:0 auto;padding:32px 16px 40px}
.kicker{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#d99a1f;font-weight:800}
h1{font-size:clamp(24px,5vw,32px);letter-spacing:-.02em;margin:6px 0 8px}
.sub{color:#334155;margin:0 0 26px;font-size:15px}
.cards{display:grid;grid-template-columns:1fr;gap:16px}
.card{display:block;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:22px;text-decoration:none;color:inherit;box-shadow:0 10px 30px rgba(11,27,52,.06);transition:transform .15s,box-shadow .15s}
.card:hover{transform:translateY(-2px);box-shadow:0 16px 36px rgba(11,27,52,.12)}
.card .tag{display:inline-block;font-size:11px;font-weight:800;letter-spacing:.06em;padding:3px 9px;border-radius:999px;background:#e2e8f0;color:#334155;margin-bottom:10px}
.card .tag.hot{background:#0b1b34;color:#f5b544}
.card .tag.aside{background:#ccfbf1;color:#0f766e}
.card h2{margin:0 0 6px;font-size:19px;letter-spacing:-.01em}
.card p{margin:0;font-size:14px;color:#64748b}
.card .meta{margin-top:12px;font-size:12px;color:#94a3b8}
@media (min-width:720px){.cards{grid-template-columns:repeat(2,1fr)}}
"""


def build_index() -> None:
    body = """<div class="wrap">
  <div class="kicker">자료</div>
  <h1>기획 · 견적 · 참고 문서</h1>
  <p class="sub">Smart Home Option Service 를 준비하면서 만든 자료를 한곳에 모았습니다. 숫자는 2026-09-11 조사 기준입니다.</p>
  <div class="cards">
    <a class="card" href="/docs/estimate-brief.html"><span class="tag hot">견적 브리프</span><h2>34평 스마트홈, 얼마에 팔아야 남을까</h2>
      <p>5단계 가격(99~699만원), 원가와 시장 위치, 한 건당 순이익, 월 시나리오를 그림으로 한 장에 정리한 요약본.</p><span class="meta">8개 섹션 · 읽는 시간 5분</span></a>
    <a class="card" href="/docs/estimate.html"><span class="tag">견적 상세</span><h2>시장 조사 및 구성 원가 전문</h2>
      <p>기존 시공업체 견적, 다나와·쿠팡·공식몰 품목 단가, 세대 HA·중앙 관제 서버 2트랙, 패키지별 원가·수익표, 조사 한계.</p><span class="meta">5장 · 표 30여 개 · 출처 링크 포함</span></a>
  </div>
</div>"""
    out = page("자료 · Smart Home Option", f"<style>{INDEX_CSS}</style>", body, "/docs/", "Smart Home Option Service · 시범 운영 중")
    (OUT / "index.html").write_text(out, encoding="utf-8", newline=NL)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    made = [
        build_markdown(ROOT / "docs" / "견적.md", "estimate.html", "/docs/estimate.html"),
        wrap_fragment(ROOT / "docs" / "site" / "estimate-brief.fragment.html", "estimate-brief.html", "/docs/estimate-brief.html",
                      "원문 docs/견적.md · 계산 tools/estimate.py · 가격은 조사 시점(2026-09-11) 값"),
    ]
    build_index()
    for name in made + ["index.html"]:
        print(f"{name}: {(OUT / name).stat().st_size:,} bytes")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
