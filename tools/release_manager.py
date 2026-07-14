#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SkyXing 版本发布管理器（纯标准库实现，无第三方依赖）

通过 GitHub API 自动完成：
  1. 创建 Release（支持 stable / beta 通道 -> 正式 / 预发布）
  2. 上传一个或多个安装包 / 资源（Android APK、Windows EXE/MSI、macOS dmg 等）
  3. 可选：强制覆盖已存在的同标签 Release（--force）
  4. 可选：仅打印将要发送的请求而不实际联网（--dry-run，便于本地校验）

典型用法
--------
  # 使用配置文件（推荐，可固化仓库 / 通道 / 资源映射）
  python tools/release_manager.py --config tools/release_config.example.json --version 1.1.4

  # 命令行直接发布（stable 正式版）
  python tools/release_manager.py \
      --repo kairuirain/skyxing-app \
      --version 1.1.4 \
      --notes "修复若干已知问题" \
      --assets "install/SkyXing/skyxing.exe:SkyXing_1.1.4_x64-setup.exe" \
               "build/skyxing-1.1.4-android.apk:skyxing-1.1.4-android.apk"

  # 发布测试版（预发布）
  python tools/release_manager.py --config cfg.json --version 1.2.0-beta.1 --channel beta

  # 本地预演（不联网）
  python tools/release_manager.py --config cfg.json --version 1.1.4 --dry-run

鉴权：通过 --token <ghp_xxx> 或环境变量 GITHUB_TOKEN 传入 Personal Access Token
      （需 repo 权限，用于创建 Release 与上传资源）。
"""

import argparse
import json
import mimetypes
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

GITHUB_API = "https://api.github.com"
UPLOAD_HOST = "https://uploads.github.com"


# ----------------------------- 底层 API 封装 -----------------------------

def _api_call(method, url, token, body=None, as_json=True):
    """发起一次 GitHub API 请求，返回 (status_code, parsed_json_or_text)。"""
    data = None
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "SkyXing-ReleaseManager",
    }
    if token and token != "none":
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8", "replace")
            return resp.status, (json.loads(raw) if as_json and raw else raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        try:
            err = json.loads(raw)
            msg = err.get("message", raw)
        except Exception:
            msg = raw
        return e.code, {"message": msg}
    except Exception as e:  # 网络层错误
        return 0, {"message": str(e)}


def _upload_asset(upload_url, token, file_path, name, dry_run=False):
    """上传单个资源到 Release。返回 (ok, info)。"""
    if not os.path.isfile(file_path):
        return False, {"error": f"资源不存在: {file_path}"}

    ctype, _ = mimetypes.guess_type(name)
    ctype = ctype or "application/octet-stream"
    size = os.path.getsize(file_path)

    base = upload_url.split("{")[0]  # 去掉 {/name,label} 占位
    url = f"{base}?name={urllib.parse.quote(name)}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": ctype,
        "User-Agent": "SkyXing-ReleaseManager",
    }

    if dry_run:
        print(f"    [dry-run] PUT {url}")
        print(f"              Content-Type={ctype}, size={size} bytes")
        return True, {"dry_run": True, "name": name, "size": size}

    with open(file_path, "rb") as f:
        data = f.read()
    req = urllib.request.Request(url, data=data, headers=headers, method="PUT")
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            info = json.loads(resp.read().decode("utf-8", "replace"))
            return True, info
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        return False, {"error": f"上传失败 {e.code}: {raw}"}
    except Exception as e:
        return False, {"error": str(e)}


# ----------------------------- 业务方法 -----------------------------

def find_release_by_tag(repo, token, tag):
    """按 tag 查找已存在的 Release，返回 release dict 或 None。"""
    status, data = _api_call("GET", f"{GITHUB_API}/repos/{repo}/releases/tags/{tag}", token)
    if status == 200:
        return data
    return None


def delete_release_and_tag(repo, token, tag, dry_run=False):
    """删除已存在的 Release 及其轻量标签（--force 时使用）。"""
    rel = find_release_by_tag(repo, token, tag)
    if not rel:
        return True
    rid = rel.get("id")
    if dry_run:
        print(f"    [dry-run] 将删除 Release #{rid} 与 tag {tag}")
        return True
    s1, _ = _api_call("DELETE", f"{GITHUB_API}/repos/{repo}/releases/{rid}", token)
    # 删除标签（忽略失败）
    _api_call("DELETE", f"{GITHUB_API}/repos/{repo}/git/refs/tags/{tag}", token)
    print(f"    [force] 已删除旧 Release #{rid} (status={s1})")
    return s1 in (200, 204, 0)


def create_release(repo, token, tag, name, body, prerelease, draft=False, dry_run=False):
    """创建 Release，返回 (ok, release_dict)。"""
    payload = {
        "tag_name": tag,
        "name": name,
        "body": body,
        "prerelease": bool(prerelease),
        "draft": bool(draft),
    }
    if dry_run:
        print(f"    [dry-run] POST {GITHUB_API}/repos/{repo}/releases")
        print(f"              {json.dumps(payload, ensure_ascii=False)}")
        return True, {"upload_url": f"{UPLOAD_HOST}/repos/{repo}/releases/0/assets{{/name,label}}"}
    status, data = _api_call("POST", f"{GITHUB_API}/repos/{repo}/releases", token, payload)
    if status not in (200, 201):
        return False, data
    return True, data


# ----------------------------- 配置加载 -----------------------------

def load_config(path):
    if not path:
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def resolve_assets(args_assets, cfg_assets, version):
    """资源列表：优先命令行 --assets，否则用配置文件。
    每个资源形如 '本地路径:GitHub上的文件名'。
    文件名中的 {version} 占位符会被替换为实际版本号。"""
    raw = args_assets or cfg_assets or []
    result = []
    for item in raw:
        if isinstance(item, dict):
            p = item["path"]
            n = item.get("name") or os.path.basename(p)
        else:
            if ":" in item:
                p, n = item.split(":", 1)
            else:
                p, n = item, os.path.basename(item)
            p, n = p.strip(), n.strip()
        if version:
            n = n.replace("{version}", version)
            p = p.replace("{version}", version)
        result.append((p, n))
    return result


# ----------------------------- 主流程 -----------------------------

def build_notes(args, cfg, version):
    if args.notes:
        notes = args.notes
    else:
        notes_file = args.notes_file or cfg.get("notes_file")
        if notes_file and os.path.isfile(notes_file):
            with open(notes_file, "r", encoding="utf-8") as f:
                notes = f.read().strip()
        else:
            notes = ""
    if version:
        notes = notes.replace("{version}", version)
    return notes


def main():
    parser = argparse.ArgumentParser(
        description="SkyXing 版本发布管理器（GitHub Releases）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--config", help="JSON 配置文件路径")
    parser.add_argument("--repo", help="目标仓库 owner/name")
    parser.add_argument("--token", help="GitHub Token（缺省读环境变量 GITHUB_TOKEN）")
    parser.add_argument("--version", help="版本号，如 1.1.4 或 1.2.0-beta.1")
    parser.add_argument("--tag", help="Release 标签（缺省由版本号加前缀生成）")
    parser.add_argument("--name", help="Release 标题（缺省同标签）")
    parser.add_argument("--channel", choices=["stable", "beta"], help="发布通道")
    parser.add_argument("--notes", help="发布说明（文本）")
    parser.add_argument("--notes-file", help="发布说明文件路径")
    parser.add_argument("--assets", nargs="+", help="资源列表，格式 '路径:GitHub文件名'")
    parser.add_argument("--tag-prefix", default="v", help="标签前缀（默认 v）")
    parser.add_argument("--draft", action="store_true", help="创建为草稿")
    parser.add_argument("--force", action="store_true", help="若标签已存在则删除后重建")
    parser.add_argument("--dry-run", action="store_true", help="仅打印请求，不实际联网")
    parser.add_argument("--list", action="store_true", help="列出仓库现有 Release 后退出")
    args = parser.parse_args()

    cfg = load_config(args.config)

    repo = args.repo or cfg.get("repo")
    if not repo:
        parser.error("必须提供 --repo 或在配置文件中指定 repo")
    token = args.token or os.environ.get("GITHUB_TOKEN")
    if not token and not args.list and not args.dry_run:
        parser.error("需要提供 --token 或设置环境变量 GITHUB_TOKEN（dry-run/list 除外）")

    # 列出模式
    if args.list:
        status, data = _api_call("GET", f"{GITHUB_API}/repos/{repo}/releases?per_page=20", token or "none")
        if status == 200:
            for r in data:
                tag = r.get("tag_name", "?")
                flag = "预发布" if r.get("prerelease") else ("草稿" if r.get("draft") else "正式")
                print(f"  {tag:20} [{flag}]  {r.get('name','')}")
        else:
            print(f"查询失败: {data}")
        return

    version = args.version or cfg.get("version")
    if not version:
        parser.error("必须提供 --version 或在配置文件中指定 version")

    channel = args.channel or cfg.get("channel", "stable")
    prerelease = channel == "beta"
    prefix = args.tag_prefix or cfg.get("tag_prefix", "v")
    tag = args.tag or f"{prefix}{version}"
    name = args.name or cfg.get("name") or tag
    notes = build_notes(args, cfg, version)
    assets = resolve_assets(args.assets, cfg.get("assets"), version)

    print(f"发布目标: {repo}")
    print(f"标签: {tag}  通道: {channel}  {'预发布' if prerelease else '正式'}")
    print(f"资源数量: {len(assets)}")

    if args.dry_run:
        print("\n=== DRY RUN ===")
        create_release(repo, token or "TOKEN", tag, name, notes, prerelease, args.draft, dry_run=True)
        for p, n in assets:
            _upload_asset("", token or "TOKEN", p, n, dry_run=True)
        print("=== END DRY RUN（未实际联网）===")
        return

    # 强制覆盖
    if args.force:
        delete_release_and_tag(repo, token, tag, dry_run=False)

    ok, rel = create_release(repo, token, tag, name, notes, prerelease, args.draft, dry_run=False)
    if not ok:
        print(f"[错误] 创建 Release 失败: {rel.get('message') if isinstance(rel, dict) else rel}")
        sys.exit(1)

    upload_url = rel.get("upload_url", "")
    print(f"Release 已创建: {rel.get('html_url')}")

    failures = 0
    for p, n in assets:
        ok_a, info = _upload_asset(upload_url, token, p, n, dry_run=False)
        if ok_a:
            print(f"  ✅ 已上传: {n}")
        else:
            failures += 1
            print(f"  ❌ 上传失败: {n} -> {info.get('error')}")
            # 若标签已存在会返回 422，提示使用 --force
            if isinstance(info, dict) and "already_exists" in str(info.get("error", "")):
                print("    提示: 该标签可能已存在，可加 --force 覆盖重建。")

    if failures:
        print(f"[警告] {failures} 个资源上传失败")
        sys.exit(2)
    print("✅ 发布完成。")


if __name__ == "__main__":
    main()
