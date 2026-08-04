#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""minify_web.py —— CSS / JS / HTML 极限压缩（纯标准库，零第三方依赖）。

功能:
  * CSS   移除注释、折叠空白、去空行、压缩分隔符、去尾部分号、
         0 值去单位(0px->0)、小数去前导0(0.5->.5)、缩短十六进制色(#ff0000->#f00)。
         自动保护字符串/url()/data URI/calc()，绝不误伤。
  * JS   完整词法分析(字符串/模板字面量/正则/注释/运算符)，安全删除注释与无
         意义空白，保留必要的空格避免 `++ -- +=` 等被合并，去掉 `}` 前多余分号。
  * HTML 移除注释、删除块级元素间的纯空白节点、折叠文本内空白(script/style/
         pre/textarea 内容原样保留)、布尔属性精简。

用法:
  python minify_web.py <文件或目录>...              # 默认输出到 <目录>_min(安全)
  python minify_web.py <目录> --in-place           # 直接覆盖原文件
  python minify_web.py <目录> --out DIR            # 镜像结构输出到 DIR
  python minify_web.py <目录> --dry-run            # 只统计不写文件
  python minify_web.py <目录> --verify             # 压缩后二次解析校验
"""
import argparse
import os
import re
import sys
from html.parser import HTMLParser

EXTS = {'.css', '.js', '.html', '.htm'}
SKIP_DIRS = {'.git', '.svn', '.hg', 'node_modules', '__pycache__', '.venv', 'venv', 'dist', 'build'}
SKIP_MATCH = re.compile(r'\.min\.(?:css|js|html?)$', re.I)

# ---------------------------------------------------------------------------
# CSS
# ---------------------------------------------------------------------------

_CSS_UNITS = 'px|em|ex|rem|vh|vw|vmin|vmax|s|ms|cm|mm|in|pt|pc|q|fr'


def _css_collect(css):
    """将 css 中字符串 / url() / calc() 用占位符替换，返回 (代码, 占位符表)。"""
    n = len(css)
    i = 0
    code = []
    ph = {}
    pid = 0

    def grab_balanced(start):
        """从 '(' 位置 start 开始，读取配对的 ')'，返回结束下标。"""
        depth = 0
        j = start
        while j < n:
            ch = css[j]
            if ch == '\\':
                j += 2
                continue
            if ch in '"\'':
                q = ch
                j += 1
                while j < n:
                    if css[j] == '\\':
                        j += 2
                        continue
                    if css[j] == q:
                        j += 1
                        break
                    j += 1
                continue
            if ch == '(':
                depth += 1
            elif ch == ')':
                depth -= 1
                if depth == 0:
                    j += 1
                    break
            j += 1
        return j

    def add(text):
        nonlocal pid
        key = '\x00P%d\x00' % pid
        ph[key] = text
        pid += 1
        return key

    while i < n:
        c = css[i]
        if c in ' \t\r\n\f':
            code.append(c)
            i += 1
            continue
        if c == '/' and css[i:i + 2] == '/*':
            j = css.find('*/', i + 2)
            i = n if j == -1 else j + 2
            continue
        if c in '"\'':
            j = i + 1
            while j < n:
                if css[j] == '\\':
                    j += 2
                    continue
                if css[j] == c:
                    j += 1
                    break
                j += 1
            code.append(add(css[i:j]))
            i = j
            continue
        m = re.match(r'(?i)(url|calc)\s*\(', css[i:i + 12])
        if m:
            open_idx = i + m.end() - 1
            j = grab_balanced(open_idx)
            code.append(add(css[i:j]))
            i = j
            continue
        code.append(c)
        i += 1
    return ''.join(code), ph


def minify_css(css):
    code, ph = _css_collect(css)
    out = re.sub(r'\s+', ' ', code)
    out = re.sub(r'\s*([{}:;,])\s*', r'\1', out)
    out = re.sub(r'\s*>\s*', '>', out)
    out = re.sub(r'\s*\+\s*', '+', out)
    out = re.sub(r'\s*~\s*', '~', out)
    out = re.sub(r'\(\s*', '(', out)
    out = re.sub(r'\s*\)', ')', out)
    out = re.sub(r';}', '}', out)
    out = re.sub(r'(?<![0-9A-Za-z_])0(\.[0-9]+)', r'\1', out)
    out = re.sub(r'(?<![0-9A-Za-z_])0(%s)\b' % _CSS_UNITS, r'0', out)
    out = re.sub(r'#([0-9a-fA-F])\1([0-9a-fA-F])\2([0-9a-fA-F])\3\b', r'#\1\2\3', out)
    for key, txt in ph.items():
        out = out.replace(key, txt)
    return out.strip()


def _verify_css(orig, mini):
    if mini.count('{') != mini.count('}'):
        return False, '花括号不平衡'
    if minify_css(mini) != mini:
        return False, '压缩结果不幂等(可能有误伤)'
    return True, 'OK'


# ---------------------------------------------------------------------------
# JS
# ---------------------------------------------------------------------------

_SPACE_KEYWORDS = frozenset(('return', 'throw', 'case', 'typeof', 'instanceof',
                             'in', 'of', 'new', 'delete', 'void', 'yield',
                             'await', 'do', 'else', 'var', 'let', 'const'))
_MERGE_OPS = ('++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=',
              '<<', '>>', '**', '&&', '||', '??', '<<=', '>>=', '**=')
_JS_OPS = ['===', '!==', '>>>', '**=', '&&=', '||=', '??=', '<<=', '>>=', '...',
           '=>', '==', '!=', '<=', '>=', '++', '--', '&&', '||', '??', '+=',
           '-=', '*=', '/=', '%=', '&=', '|=', '^=', '**', '<<', '>>', '?.']

_REGEX_AFTER_KEYWORDS = frozenset(('return', 'typeof', 'instanceof', 'in', 'of',
                                   'new', 'case', 'delete', 'void', 'yield',
                                   'await', 'throw', 'do', 'else', 'extends'))


def _regex_allowed(prev, close_ctx):
    if prev is None:
        return True
    t, text = prev
    if t in ('str', 'num', 'regex', 'tpl'):
        return False
    if t == 'word':
        return text in _REGEX_AFTER_KEYWORDS
    if text == '}':
        return close_ctx == 'block'
    if text in (')', ']'):
        return False
    return True


def _brace_ctx(prev, stack):
    if prev is None:
        return 'block'
    t, text = prev
    if t == 'op':
        if text in (')', ']', ';', '}', '=>'):
            return 'block'
        if text == ':':
            return 'object' if (stack and stack[-1] == 'object') else 'block'
        return 'object'
    if t == 'word':
        if text in ('do', 'else', 'try', 'finally', 'function', 'class', 'static',
                    'async', 'switch', 'while', 'for', 'if', 'with', 'case', 'default'):
            return 'block'
        if text in ('return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete',
                    'void', 'yield', 'await', 'throw', 'extends'):
            return 'object'
        return 'block'
    return 'object'


def _js_tokenize(src):
    n = len(src)
    i = 0
    tokens = []
    prev = None
    last_close_ctx = None
    stack = []

    def finish(kind, text, i_new, close_ctx=None):
        nonlocal prev, last_close_ctx
        tokens.append((kind, text))
        prev = (kind, text)
        last_close_ctx = close_ctx
        return i_new

    while i < n:
        c = src[i]
        if c in ' \t\r\n\f\v':
            i += 1
            continue
        if c == '/' and src[i:i + 2] == '//':
            j = src.find('\n', i)
            i = n if j == -1 else j + 1
            continue
        if c == '/' and src[i:i + 2] == '/*':
            j = src.find('*/', i + 2)
            i = n if j == -1 else j + 2
            continue
        if c in '"\'':
            j = i + 1
            while j < n:
                if src[j] == '\\':
                    j += 2
                    continue
                if src[j] == c:
                    j += 1
                    break
                j += 1
            i = finish('str', src[i:j], j)
            continue
        if c == '`':
            j = i + 1
            depth = 0
            while j < n:
                ch = src[j]
                if ch == '\\':
                    j += 2
                    continue
                if ch == '`' and depth == 0:
                    j += 1
                    break
                if ch == '$' and src[j:j + 2] == '${' and depth == 0:
                    depth = 1
                    j += 2
                    continue
                if depth:
                    if ch in '"\'':
                        q = ch
                        j += 1
                        while j < n:
                            if src[j] == '\\':
                                j += 2
                                continue
                            if src[j] == q:
                                j += 1
                                break
                            j += 1
                        continue
                    if ch == '{':
                        depth += 1
                    elif ch == '}':
                        depth -= 1
                    j += 1
                    continue
                j += 1
            i = finish('tpl', src[i:j], j)
            continue
        if c == '/' and _regex_allowed(prev, last_close_ctx):
            j = i + 1
            in_class = False
            while j < n:
                ch = src[j]
                if ch == '\\':
                    j += 2
                    continue
                if ch == '\n':
                    break
                if ch == '[':
                    in_class = True
                elif ch == ']':
                    in_class = False
                elif ch == '/' and not in_class:
                    j += 1
                    break
                j += 1
            while j < n and src[j].isalpha():
                j += 1
            i = finish('regex', src[i:j], j)
            continue
        m = re.match(r'[A-Za-z_$][A-Za-z0-9_$]*', src[i:])
        if m:
            i = finish('word', m.group(0), i + len(m.group(0)))
            continue
        m = re.match(r'(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|'
                     r'\d[\d_]*(?:\.[\d_]*)?(?:[eE][+-]?[\d_]+)?|'
                     r'\.[\d_]+(?:[eE][+-]?[\d_]+)?)', src[i:])
        if m:
            i = finish('num', m.group(0), i + len(m.group(0)))
            continue
        matched = next((op for op in _JS_OPS if src.startswith(op, i)), c)
        i = finish('op', matched, i + len(matched),
                   close_ctx=(stack.pop() if matched == '}' and stack else None))
        if matched == '{':
            stack.append(_brace_ctx(prev, stack))
        continue
    return tokens


def _need_space(t1, t2):
    a1 = t1[1][-1]
    b1 = t2[1][0]

    def is_word(ch):
        return ch.isalnum() or ch in '_$' or ord(ch) > 127

    if t1[0] in ('word', 'num') and t2[0] in ('word', 'num'):
        return True
    if t2[0] == 'regex' and t1[0] in ('word', 'num'):
        return True
    if t1[0] == 'word' and t1[1] in _SPACE_KEYWORDS:
        return b1 not in ';}),.:'
    return a1 + b1 in _MERGE_OPS


def _drop_semicolons(tokens):
    n = len(tokens)
    out = []
    for idx, (kind, text) in enumerate(tokens):
        if kind == 'op' and text == ';':
            j = idx
            while j < n and tokens[j][0] == 'op' and tokens[j][1] == ';':
                j += 1
            if j >= n or (tokens[j][0] == 'op' and tokens[j][1] == '}'):
                continue
        out.append((kind, text))
    return out


def _reemit(tokens):
    parts = []
    prev = None
    for kind, text in tokens:
        if prev is not None and _need_space(prev, (kind, text)):
            parts.append(' ')
        if kind == 'num' and re.match(r'0\.\d', text):
            text = text[1:]
        parts.append(text)
        prev = (kind, text)
    return ''.join(parts)


def minify_js(js):
    toks = _drop_semicolons(_js_tokenize(js))
    return _reemit(toks)


def _js_signature(src):
    out = []
    for kind, text in _drop_semicolons(_js_tokenize(src)):
        if kind == 'num' and re.match(r'0\.\d', text):
            text = text[1:]
        out.append((kind, text))
    return out


def _verify_js(orig, mini):
    if _js_signature(orig) != _js_signature(mini):
        return False, '词法符号序列不一致(可能改变了语义)'
    return True, 'OK'


# ---------------------------------------------------------------------------
# HTML
# ---------------------------------------------------------------------------

_BLOCK = frozenset(('address', 'article', 'aside', 'blockquote', 'body',
                    'caption', 'dd', 'details', 'dialog', 'div', 'dl', 'dt',
                    'fieldset', 'figcaption', 'figure', 'footer', 'form',
                    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup',
                    'hr', 'html', 'legend', 'li', 'main', 'menu', 'nav', 'ol',
                    'p', 'pre', 'section', 'summary', 'table', 'tbody', 'td',
                    'tfoot', 'th', 'thead', 'tr', 'ul', 'head'))
_VERBATIM = frozenset(('script', 'style', 'pre', 'textarea'))
_VOID = frozenset(('area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
                   'link', 'meta', 'param', 'source', 'track', 'wbr'))
_BOOL_ATTRS = frozenset(('checked', 'disabled', 'selected', 'multiple',
                         'readonly', 'required', 'autofocus', 'hidden',
                         'defer', 'async', 'novalidate', 'itemscope', 'ismap',
                         'nomodule', 'playsinline', 'controls', 'loop',
                         'muted', 'autoplay'))


class _HTMLCollector(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.events = []

    def handle_starttag(self, tag, attrs):
        self.events.append(('start', tag, attrs))

    def handle_startendtag(self, tag, attrs):
        self.events.append(('startend', tag, attrs))

    def handle_endtag(self, tag):
        self.events.append(('end', tag))

    def handle_data(self, data):
        self.events.append(('data', data))

    def handle_comment(self, data):
        self.events.append(('comment', data))

    def handle_decl(self, decl):
        self.events.append(('decl', decl))

    def handle_pi(self, data):
        self.events.append(('pi', data))


def _emit_tag(name, attrs):
    s = '<' + name
    for k, v in attrs:
        if v is None or v == '':
            s += ' ' + k
        elif k in _BOOL_ATTRS and v == k:
            s += ' ' + k
        else:
            s += ' ' + k + '="' + v + '"'
    return s + '>'


def _build_html(events, minify_inline=False):
    stack = []
    out = []
    n = len(events)

    def is_block(name):
        return name in _BLOCK or name == 'br'

    for idx, ev in enumerate(events):
        kind = ev[0]
        if kind == 'comment':
            txt = ev[1]
            if txt.startswith('[') and txt.endswith(']'):
                out.append('<!--' + txt + '-->')
            continue
        if kind == 'decl':
            out.append('<!' + ev[1] + '>')
            continue
        if kind == 'pi':
            continue
        if kind == 'start':
            name = ev[1]
            if name in _VERBATIM:
                stack.append(name)
            out.append(_emit_tag(name, ev[2]))
            continue
        if kind == 'startend':
            out.append(_emit_tag(ev[1], ev[2]))
            continue
        if kind == 'end':
            name = ev[1]
            if name in _VERBATIM and stack:
                stack.pop()
            if name in _VOID:
                continue
            out.append('</' + name + '>')
            continue
        # data
        text = ev[1]
        if stack:
            if minify_inline and stack[-1] == 'style' and text.strip():
                text = minify_css(text)
            elif minify_inline and stack[-1] == 'script' and text.strip():
                text = minify_js(text)
            out.append(text)
            continue
        if text.strip() == '':
            prev_ev = events[idx - 1] if idx > 0 else None
            next_ev = events[idx + 1] if idx + 1 < n else None
            prev_tag = prev_ev[1] if (prev_ev and prev_ev[0] in ('start', 'startend', 'end')) else None
            next_tag = next_ev[1] if (next_ev and next_ev[0] in ('start', 'startend', 'end')) else None
            if prev_tag is None and next_tag is None:
                out.append(' ')
            elif (prev_tag is not None and is_block(prev_tag)) or \
                 (next_tag is not None and is_block(next_tag)):
                continue
            else:
                out.append(' ')
            continue
        t = re.sub(r'\s+', ' ', text)
        prev_ev = events[idx - 1] if idx > 0 else None
        next_ev = events[idx + 1] if idx + 1 < n else None
        prev_tag = prev_ev[1] if (prev_ev and prev_ev[0] in ('start', 'startend', 'end')) else None
        next_tag = next_ev[1] if (next_ev and next_ev[0] in ('start', 'startend', 'end')) else None
        if prev_tag is not None and is_block(prev_tag):
            t = t.lstrip()
        if next_tag is not None and is_block(next_tag):
            t = t.rstrip()
        if out and out[-1] == ' ' and t.startswith(' '):
            t = t.lstrip()
        if t:
            out.append(t)
    return ''.join(out)


def minify_html(html, minify_inline=False):
    p = _HTMLCollector()
    p.feed(html)
    return _build_html(p.events, minify_inline=minify_inline)


def _html_tag_seq(html):
    p = _HTMLCollector()
    p.feed(html)
    seq = []
    for ev in p.events:
        kind, name = ev[0], ev[1]
        if kind == 'startend':
            seq.append(('start', name))
        elif kind in ('start', 'end', 'decl'):
            seq.append((kind, name))
    return seq


def _verify_html(orig, mini):
    if _html_tag_seq(orig) != _html_tag_seq(mini):
        return False, '标签结构不一致'
    if orig.count('<script') != mini.count('<script'):
        return False, 'script 数量变化'
    return True, 'OK'


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------

def _minify_text(text, ext, minify_inline):
    if ext == '.css':
        return minify_css(text)
    if ext == '.js':
        return minify_js(text)
    return minify_html(text, minify_inline=minify_inline)


def _verify(text, mini, ext):
    if ext == '.css':
        return _verify_css(text, mini)
    if ext == '.js':
        return _verify_js(text, mini)
    return _verify_html(text, mini)


def _iter_files(paths):
    for p in paths:
        p = os.path.abspath(p)
        if os.path.isfile(p):
            yield p, os.path.dirname(p)
            continue
        for dp, dirs, files in os.walk(p):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            for f in files:
                if os.path.splitext(f)[1].lower() in EXTS and not SKIP_MATCH.search(f):
                    yield os.path.join(dp, f), p


def _target_path(src, root, args):
    if args.in_place:
        return src
    rel = os.path.relpath(src, root) if os.path.isdir(root) else os.path.basename(src)
    if args.out:
        return os.path.join(args.out, rel)
    base = root if os.path.isdir(root) else os.path.dirname(root)
    return os.path.join(base + '_min', rel)


def main(argv=None):
    ap = argparse.ArgumentParser(description='CSS/JS/HTML 极限压缩(纯标准库)')
    ap.add_argument('paths', nargs='+', help='文件或目录')
    ap.add_argument('--in-place', action='store_true', help='直接覆盖原文件')
    ap.add_argument('--out', metavar='DIR', help='输出到 DIR(镜像目录结构)')
    ap.add_argument('--dry-run', action='store_true', help='只统计不写入')
    ap.add_argument('--verify', action='store_true', help='压缩后二次解析校验')
    ap.add_argument('--minify-inline', action='store_true', help='同时压缩 <style>/<script> 内联内容')
    args = ap.parse_args(argv)

    rows = []
    total_o = total_n = 0
    failed = 0
    for src, root in _iter_files(args.paths):
        ext = os.path.splitext(src)[1].lower()
        try:
            with open(src, 'r', encoding='utf-8', newline='') as f:
                text = f.read()
        except UnicodeDecodeError:
            print('[SKIP] %s (非 UTF-8)' % os.path.relpath(src))
            failed += 1
            continue
        mini = _minify_text(text, ext, args.minify_inline)
        o = len(text.encode('utf-8'))
        n = len(mini.encode('utf-8'))
        status = ''
        if args.verify:
            ok, msg = _verify(text, mini, ext)
            status = 'OK' if ok else 'FAIL:' + msg
            if not ok:
                failed += 1
        rows.append((os.path.relpath(src, root), o, n, status))
        total_o += o
        total_n += n
        if not args.dry_run:
            dst = _target_path(src, root, args)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            with open(dst, 'w', encoding='utf-8', newline='\n') as f:
                f.write(mini)
            if o != n:
                print('压缩 %s -> %s' % (os.path.relpath(src, root), os.path.relpath(dst, root)))

    if not rows:
        print('没有找到匹配的文件')
        return 1

    width = max(len(r[0]) for r in rows)
    print()
    print('%-*s %10s %10s %10s %8s  %s' % (width, '文件', '原始', '压缩后', '节省', '比例', '校验'))
    print('-' * (width + 60))
    for name, o, n, st in rows:
        saved = o - n
        pct = (saved / o * 100) if o else 0
        print('%-*s %10d %10d %10d %7.1f%%  %s' % (width, name, o, n, saved, pct, st))
    print('-' * (width + 60))
    pct = (total_o - total_n) / total_o * 100 if total_o else 0
    print('%-*s %10d %10d %10d %7.1f%%  %s' % (width, '合计', total_o, total_n,
                                               total_o - total_n, pct,
                                               '%d 个文件失败' % failed if failed else ''))
    return 0 if failed == 0 else 1


if __name__ == '__main__':
    sys.exit(main())
