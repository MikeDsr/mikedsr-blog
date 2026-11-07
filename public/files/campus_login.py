#!/usr/bin/env python3
"""北航校园网 (gw.buaa.edu.cn, 深澜 SRun) 自动登录脚本

用法:
  python3 campus_login.py           检查状态，掉线就自动登录（默认）
  python3 campus_login.py status    只查看当前在线状态
  python3 campus_login.py login     不管在不在线，立即登录一次

账号密码放在本脚本同目录的 campus.conf 里（权限应为 600）:
  USERNAME=学号
  PASSWORD=密码
  AC_ID=          (可选，留空则自动识别)

退出码: 0 = 在线/登录成功   1 = 离线/登录失败   2 = 连不上认证服务器
只用 Python 标准库，不需要 pip 安装任何东西。
"""
import base64
import hashlib
import hmac
import json
import os
import random
import re
import stat
import sys
import time
import urllib.parse
import urllib.request

GW = "https://gw.buaa.edu.cn"
CONF = os.path.join(os.path.dirname(os.path.abspath(__file__)), "campus.conf")
DEFAULT_AC_ID = "78"
TIMEOUT = 10
UA = ("Mozilla/5.0 (X11; Linux aarch64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")


def log(msg):
    print(time.strftime("%Y-%m-%d %H:%M:%S"), msg, flush=True)


# ---------------------------------------------------------------- 配置
def load_conf():
    if not os.path.exists(CONF):
        log(f"找不到配置文件 {CONF}，请先创建（见教程）")
        sys.exit(1)
    if stat.S_IMODE(os.stat(CONF).st_mode) & 0o077:
        log(f"警告：配置文件别人也能读，建议执行  chmod 600 {CONF}")
    conf = {}
    with open(CONF, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\r\n")
            if not line.strip() or line.lstrip().startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            conf[key.strip().upper()] = value
    conf["USERNAME"] = conf.get("USERNAME", "").strip()
    if not conf["USERNAME"] or not conf.get("PASSWORD"):
        log("配置文件里缺少 USERNAME 或 PASSWORD")
        sys.exit(1)
    return conf


# ---------------------------------------------------------------- 网络
def http_get(url, params=None):
    if params:
        url += "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return resp.geturl(), resp.read().decode("utf-8", "replace")


def jsonp(path, params):
    """深澜接口返回 jQuery123(...) 这种格式，这里把括号里的 JSON 取出来"""
    now = int(time.time() * 1000)
    callback = "jQuery1124%016d_%d" % (random.randrange(10 ** 16), now)
    params = dict(params, callback=callback, _=now)
    _, text = http_get(GW + path, params)
    m = re.search(r"\((.*)\)\s*;?\s*$", text, re.S)
    return json.loads(m.group(1) if m else text)


# ---------------------------------------------------------------- 深澜加密
def _str_to_words(a, append_len):
    words = []
    for i in range(0, len(a), 4):
        w = 0
        for j in range(4):
            if i + j < len(a):
                w |= ord(a[i + j]) << (8 * j)
        words.append(w)
    if append_len:
        words.append(len(a))
    return words


def _words_to_str(words):
    return "".join(
        chr(w & 0xFF) + chr(w >> 8 & 0xFF) + chr(w >> 16 & 0xFF) + chr(w >> 24 & 0xFF)
        for w in words)


def xencode(msg, key):
    if not msg:
        return ""
    v = _str_to_words(msg, True)
    k = _str_to_words(key, False)
    k += [0] * (4 - len(k))
    mask = 0xFFFFFFFF
    n = len(v) - 1
    z = v[n]
    delta = 0x9E3779B9
    d = 0
    rounds = 6 + 52 // (n + 1)
    while rounds > 0:
        d = (d + delta) & mask
        e = (d >> 2) & 3
        for p in range(n + 1):
            y = v[(p + 1) % (n + 1)]
            m = (z >> 5) ^ ((y << 2) & mask)
            m += ((y >> 3) ^ ((z << 4) & mask)) ^ (d ^ y)
            m += k[(p & 3) ^ e] ^ z
            v[p] = (v[p] + m) & mask
            z = v[p]
        rounds -= 1
    return _words_to_str(v)


_STD_B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
_SRUN_B64 = "LVoJPiCN2R8G90yg+hmFHuacZ1OWMnrsSTXkYpUq/3dlbfKwv6xztjI7DeBE45QA"
_B64_TABLE = str.maketrans(_STD_B64, _SRUN_B64)


def srun_base64(s):
    return base64.b64encode(s.encode("latin-1")).decode().translate(_B64_TABLE)


# ---------------------------------------------------------------- 业务
def detect_ac_id(conf):
    if conf.get("AC_ID", "").strip():
        return conf["AC_ID"].strip()
    for url in (GW + "/", "http://gw.buaa.edu.cn/"):
        try:
            final_url, body = http_get(url)
        except Exception:
            continue
        m = re.search(r"ac_id=(\d+)", final_url) or re.search(r"ac_id=(\d+)", body)
        if m:
            return m.group(1)
    return DEFAULT_AC_ID


def get_status():
    return jsonp("/cgi-bin/rad_user_info", {})


def is_online(status):
    return status.get("error") == "ok"


def show_status(status):
    if is_online(status):
        used_gb = int(status.get("sum_bytes", 0) or 0) / 1024 ** 3
        log(f"在线 ✔  账号 {status.get('user_name', '?')}  "
            f"IP {status.get('online_ip', '?')}  已用流量 {used_gb:.2f} GB")
    else:
        log(f"离线 ✘  ({status.get('error', '未知')})  "
            f"本机在认证系统看到的 IP: {status.get('client_ip') or status.get('online_ip') or '?'}")


def login(conf, status):
    user, pwd = conf["USERNAME"], conf["PASSWORD"]
    ac_id = detect_ac_id(conf)
    ip = status.get("client_ip") or status.get("online_ip") or ""

    challenge = jsonp("/cgi-bin/get_challenge", {"username": user, "ip": ip})
    token = challenge.get("challenge")
    ip = challenge.get("client_ip") or ip
    if not token or not ip:
        log(f"获取 challenge 失败: {challenge.get('error')} {challenge.get('error_msg', '')}")
        return 1

    info_json = json.dumps(
        {"username": user, "password": pwd, "ip": ip, "acid": ac_id, "enc_ver": "srun_bx1"},
        separators=(",", ":"))
    info = "{SRBX1}" + srun_base64(xencode(info_json, token))
    hmd5 = hmac.new(token.encode(), pwd.encode(), hashlib.md5).hexdigest()
    n, typ = "200", "1"
    chkstr = "".join(token + part for part in (user, hmd5, ac_id, ip, n, typ, info))

    log(f"正在登录… 账号 {user}  IP {ip}  ac_id {ac_id}")
    result = jsonp("/cgi-bin/srun_portal", {
        "action": "login",
        "username": user,
        "password": "{MD5}" + hmd5,
        "os": "Linux",
        "name": "Linux",
        "double_stack": "0",
        "chksum": hashlib.sha1(chkstr.encode()).hexdigest(),
        "info": info,
        "ac_id": ac_id,
        "ip": ip,
        "n": n,
        "type": typ,
    })

    err = str(result.get("error", ""))
    msg = str(result.get("error_msg", "") or result.get("suc_msg", ""))
    if err == "ok" or "already_online" in err + msg:
        time.sleep(2)
        after = get_status()
        if is_online(after):
            log("登录成功 ✔")
            show_status(after)
            return 0
        log("认证系统接受了登录，但暂时查不到在线状态，过几秒再用 status 看看")
        return 1
    log(f"登录失败 ✘  error={err}  msg={msg}  ecode={result.get('ecode', '')}")
    return 1


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "auto"
    if cmd in ("-h", "--help", "help"):
        print(__doc__)
        return 0
    if cmd not in ("auto", "status", "login"):
        print(f"不认识的命令: {cmd}\n{__doc__}")
        return 1

    conf = None if cmd == "status" else load_conf()
    try:
        status = get_status()
    except Exception as e:
        log(f"连不上认证服务器 {GW}：{e}")
        return 2
    show_status(status)

    if cmd == "status":
        return 0 if is_online(status) else 1
    if cmd == "auto" and is_online(status):
        return 0
    try:
        return login(conf, status)
    except Exception as e:
        log(f"登录过程中出错：{e}")
        return 2


if __name__ == "__main__":
    sys.exit(main())
