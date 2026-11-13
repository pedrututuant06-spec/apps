#!/usr/bin/env python3
"""
Jarvis Local — servidor da família.

- Só usa a biblioteca padrão do Python 3 (nada para instalar).
- Conversa com o Ollama local (http://127.0.0.1:11434).
- 4 perfis separados, conversas salvas por perfil.
- Limite de pessoas conectadas ao mesmo tempo (padrão 4) com sala de espera.
- Fila de respostas: quando o Jarvis está respondendo outra pessoa, mostra a
  posição na fila e quem está sendo atendido.
- API compatível com OpenAI em /v1 (para o "projeto Jarvis" usar a IA local).
- Porta principal (Mac + Wi-Fi) e porta "externa" separada, usada somente pelo
  túnel (link para fora de casa). Tudo que chega pela porta externa exige o
  código da família.
"""
import hashlib
import hmac
import json
import os
import re
import secrets
import sys
import threading
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

VERSION = "1.0.0"
BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"


def default_home():
    if sys.platform == "darwin":
        return Path.home() / "Library" / "Application Support" / "Jarvis"
    return Path.home() / ".jarvis"


HOME = Path(os.environ.get("JARVIS_HOME", default_home()))
CONFIG_PATH = HOME / "config.json"
DEVICES_PATH = HOME / "devices.json"
CONV_DIR = HOME / "conversations"

SEAT_TTL = 45          # segundos sem sinal para liberar a vaga de uma pessoa
MAX_BODY = 1_000_000   # 1 MB

DEFAULT_PROFILES = [
    {"id": "p1", "name": "Pessoa 1", "emoji": "🧑", "color": "#ff8a00", "kid": False, "admin": True},
    {"id": "p2", "name": "Pessoa 2", "emoji": "👩", "color": "#ffb347", "kid": False, "admin": False},
    {"id": "p3", "name": "Pessoa 3", "emoji": "🧒", "color": "#4fc3f7", "kid": False, "admin": False},
    {"id": "p4", "name": "Pessoa 4", "emoji": "👦", "color": "#81c784", "kid": False, "admin": False},
]

BASE_PROMPT = """Você é o Jarvis, um assistente pessoal de inteligência artificial de altíssimo nível — o assistente de confiança do seu dono e da família dele. Você reúne o melhor dos grandes assistentes: o cuidado, a honestidade e a escrita impecável do Claude; a versatilidade do ChatGPT; a organização e a clareza do Gemini; e a objetividade com bom humor do Grok.

Identidade e tom:
- Seu nome é Jarvis. Se perguntarem quem você é, diga que é o Jarvis, assistente pessoal.
- Responda SEMPRE em português do Brasil, a menos que peçam outro idioma.
- Seja inteligente, prestativo, educado e acolhedor, com um toque leve de humor quando couber. Trate a pessoa como alguém capaz.

Como responder (rápido e certeiro):
- Comece direto pela resposta. Nada de introduções longas, repetir a pergunta ou "Ótima pergunta!".
- Ajuste o tamanho à pergunta: pergunta simples, resposta curta; tarefa complexa, resposta completa e organizada.
- Use Markdown quando ajudar: listas, passos numerados, **negrito** para o essencial, tabelas para comparações e blocos de código para programação.
- Em problemas difíceis (matemática, lógica, código, decisões), raciocine passo a passo e confira o resultado antes de concluir.
- Quando fizer sentido, termine com uma sugestão prática de próximo passo.

Do que você é capaz: tirar dúvidas de qualquer assunto, escrever e revisar textos, e-mails e mensagens, resumir, traduzir, programar e explicar código, planejar estudos, viagens, finanças e rotinas, dar ideias criativas, ajudar em trabalhos escolares e conversar.

Honestidade:
- Seu conhecimento tem data de corte e você pode não ter acesso à internet. Para notícias, preços, placares ou clima atuais, avise isso com naturalidade.
- Se não souber, diga que não sabe. Nunca invente fatos, números, links, citações ou referências.
- Em saúde, direito e finanças, dê informações úteis e recomende um profissional quando a decisão for importante.
- Recuse com gentileza pedidos perigosos ou ilegais e ofereça uma alternativa útil."""

KID_PROMPT = """
Atenção: você está conversando com uma criança ou adolescente.
- Use linguagem simples, frases curtas, exemplos do dia a dia e muito incentivo.
- Em tarefas escolares, ajude a criança a ENTENDER e a pensar passo a passo, em vez de só entregar a resposta pronta.
- Mantenha todo o conteúdo apropriado para a idade. Se o assunto for sensível ou perigoso, responda com cuidado e sugira conversar com os pais ou um adulto de confiança."""

WEEKDAYS = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"]
MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto",
          "setembro", "outubro", "novembro", "dezembro"]


def now_text():
    n = datetime.now()
    return f"{WEEKDAYS[n.weekday()]}, {n.day} de {MONTHS[n.month - 1]} de {n.year}, {n:%H:%M}"


CODE_PROMPT = """Você é o Jarvis Code, o modo programador do Jarvis: um engenheiro de software sênior, paciente e preciso. Responda sempre em português do Brasil (o código e os nomes técnicos podem ficar em inglês).

Como trabalhar:
- Entenda o objetivo antes de escrever código. Se faltar uma informação essencial, faça no máximo uma pergunta curta; senão, assuma o mais razoável e diga o que assumiu.
- Entregue código COMPLETO e funcional, em blocos ```com a linguagem indicada```, pronto para copiar e colar. Nada de "..." ou partes omitidas, a menos que a pessoa peça só um trecho.
- Diga em qual arquivo cada bloco vai e os comandos exatos para instalar dependências e rodar.
- Para erros: explique a causa em uma ou duas frases, mostre a correção e como evitar no futuro.
- Prefira soluções simples, legíveis e seguras (sem senhas no código, validando entradas). Comente só o que não for óbvio.
- Para quem está aprendendo, explique os conceitos passo a passo com exemplos pequenos.
- Seja honesto: se não tiver certeza de uma API ou versão de biblioteca, avise e sugira como confirmar na documentação."""


def system_prompt(profile=None, engine="jarvis"):
    p = CODE_PROMPT if engine == "code" else BASE_PROMPT
    if engine == "turbo":
        p += "\n\nModo Turbo: responda de forma especialmente curta e direta, a menos que peçam detalhes."
    if profile:
        p += f"\n\nVocê está conversando agora com {profile['name']}. Chame a pessoa pelo nome de vez em quando, com naturalidade."
        if profile.get("kid"):
            p += KID_PROMPT
    p += f"\n\nData e hora atuais: {now_text()}."
    return p


# --------------------------------------------------------------------------- #
# Armazenamento
# --------------------------------------------------------------------------- #
store_lock = threading.RLock()


def read_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)
    try:
        os.chmod(path, 0o600)
    except OSError:
        pass


def gen_family_code():
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    raw = "".join(secrets.choice(alphabet) for _ in range(8))
    return raw[:4] + "-" + raw[4:]


def load_config():
    cfg = read_json(CONFIG_PATH, {})
    changed = False
    defaults = {
        "models": {"jarvis": "gemma3:4b", "turbo": "gemma3:1b", "code": "qwen2.5-coder:3b"},
        "num_ctx_code": 8192,
        "port": 8080,
        "external_port": 8081,
        "lan": True,
        "max_users": 4,
        "max_concurrent": 1,
        "num_ctx": 4096,
        "keep_alive": "24h",
        "history_messages": 24,
        "ollama_url": "http://127.0.0.1:11434",
        "tunnel_log": str(Path.home() / "Library" / "Logs" / "Jarvis" / "tunnel.log"),
    }
    for k, v in defaults.items():
        if k not in cfg:
            cfg[k] = v
            changed = True
    if not cfg.get("family_code"):
        cfg["family_code"] = gen_family_code()
        changed = True
    if not cfg.get("api_key"):
        cfg["api_key"] = "jv-" + secrets.token_urlsafe(24)
        changed = True
    if not cfg.get("profiles"):
        cfg["profiles"] = [dict(p, pin_hash="") for p in DEFAULT_PROFILES]
        changed = True
    if changed:
        write_json(CONFIG_PATH, cfg)
    return cfg


CFG = {}
DEVICES = {}


def save_config():
    with store_lock:
        write_json(CONFIG_PATH, CFG)


def save_devices():
    with store_lock:
        write_json(DEVICES_PATH, DEVICES)


def hash_pin(pin):
    salt = secrets.token_hex(8)
    h = hashlib.pbkdf2_hmac("sha256", pin.encode(), salt.encode(), 100_000).hex()
    return f"{salt}${h}"


def valid_pin(pin):
    return 4 <= len(pin) <= 32


def check_pin(pin, stored):
    if not stored:
        return False
    try:
        salt, h = stored.split("$", 1)
    except ValueError:
        return False
    calc = hashlib.pbkdf2_hmac("sha256", (pin or "").encode(), salt.encode(), 100_000).hex()
    return hmac.compare_digest(calc, h)


def get_profile(pid):
    for p in CFG["profiles"]:
        if p["id"] == pid:
            return p
    return None


def public_profile(p):
    return {
        "id": p["id"], "name": p["name"], "emoji": p.get("emoji", "🙂"),
        "color": p.get("color", "#ff8a00"), "kid": bool(p.get("kid")),
        "admin": bool(p.get("admin")), "has_pin": bool(p.get("pin_hash")),
    }


SAFE_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")


def conv_path(pid, cid):
    if not SAFE_ID.match(pid) or not SAFE_ID.match(cid):
        raise ValueError("id inválido")
    return CONV_DIR / pid / f"{cid}.json"


def list_conversations(pid):
    folder = CONV_DIR / pid
    out = []
    if folder.is_dir():
        for f in folder.glob("*.json"):
            c = read_json(f, None)
            if c:
                out.append({"id": c["id"], "title": c.get("title", "Conversa"),
                            "updated": c.get("updated", 0), "kind": c.get("kind", "chat")})
    out.sort(key=lambda c: c["updated"], reverse=True)
    return out


# --------------------------------------------------------------------------- #
# Vagas (máximo de pessoas conectadas) e fila de respostas
# --------------------------------------------------------------------------- #
class Seats:
    """Controla quantas pessoas (dispositivos) usam o Jarvis ao mesmo tempo."""

    def __init__(self):
        self.lock = threading.Lock()
        self.seated = {}    # key -> {"last": t, "name": str}
        self.waiting = []   # [{"key", "last", "name"}]

    def _purge(self, now):
        for k in [k for k, v in self.seated.items() if now - v["last"] > SEAT_TTL]:
            del self.seated[k]
        self.waiting = [w for w in self.waiting if now - w["last"] <= SEAT_TTL]

    def ping(self, key, name, limit):
        now = time.time()
        with self.lock:
            self._purge(now)
            if key in self.seated:
                self.seated[key] = {"last": now, "name": name}
                return {"seated": True}
            w = next((w for w in self.waiting if w["key"] == key), None)
            if not w:
                w = {"key": key, "last": now, "name": name}
                self.waiting.append(w)
            w["last"], w["name"] = now, name
            free = limit - len(self.seated)
            idx = self.waiting.index(w)
            if idx < free:
                self.waiting.remove(w)
                self.seated[key] = {"last": now, "name": name}
                return {"seated": True}
            return {"seated": False, "position": idx + 1,
                    "online": [v["name"] for v in self.seated.values()]}

    def is_seated(self, key):
        with self.lock:
            v = self.seated.get(key)
            if v and time.time() - v["last"] <= SEAT_TTL:
                v["last"] = time.time()
                return True
            return False

    def leave(self, key):
        with self.lock:
            self.seated.pop(key, None)
            self.waiting = [w for w in self.waiting if w["key"] != key]

    def online(self):
        with self.lock:
            self._purge(time.time())
            return [v["name"] for v in self.seated.values()], len(self.waiting)


class GenQueue:
    """Fila justa (por ordem de chegada) para as respostas do modelo."""

    def __init__(self):
        self.cond = threading.Condition()
        self.waiting = []   # tickets
        self.running = []   # tickets

    def enqueue(self, name):
        t = {"id": uuid.uuid4().hex, "name": name, "since": time.time()}
        with self.cond:
            self.waiting.append(t)
            self.cond.notify_all()
        return t

    def try_start(self, t, limit):
        """Retorna None se começou, ou (posição, [nomes sendo atendidos])."""
        with self.cond:
            free = max(0, limit - len(self.running))
            idx = self.waiting.index(t)
            if idx < free:
                self.waiting.remove(t)
                self.running.append(t)
                return None
            return idx + 1, [r["name"] for r in self.running]

    def wait(self, timeout):
        with self.cond:
            self.cond.wait(timeout)

    def done(self, t):
        with self.cond:
            if t in self.waiting:
                self.waiting.remove(t)
            if t in self.running:
                self.running.remove(t)
            self.cond.notify_all()

    def snapshot(self):
        with self.cond:
            return [r["name"] for r in self.running], [w["name"] for w in self.waiting]


SEATS = Seats()
QUEUE = GenQueue()


# --------------------------------------------------------------------------- #
# Ollama
# --------------------------------------------------------------------------- #
def ollama_request(path, payload=None, timeout=600):
    url = CFG["ollama_url"].rstrip("/") + path
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"},
                                 method="POST" if data else "GET")
    return urllib.request.urlopen(req, timeout=timeout)


def ollama_ok():
    try:
        with ollama_request("/api/tags", timeout=3) as r:
            models = [m["name"] for m in json.load(r).get("models", [])]
        return True, models
    except Exception:
        return False, []


def ollama_stream(messages, model=None, options=None):
    """Gera pedaços de texto do Ollama. Lança RuntimeError com mensagem amigável."""
    opts = {"num_ctx": CFG["num_ctx"]}
    if options:
        opts.update(options)
    payload = {"model": model or engine_model("jarvis"), "messages": messages, "stream": True,
               "keep_alive": CFG["keep_alive"], "options": opts}
    try:
        resp = ollama_request("/api/chat", payload)
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="ignore")
        if "not found" in body:
            raise RuntimeError(f"O modelo {payload['model']} ainda não foi baixado. Rode o instalador novamente.")
        raise RuntimeError(f"O Ollama recusou o pedido: {body[:200]}")
    except Exception:
        raise RuntimeError("Não consegui falar com o Ollama. Ele está aberto? (ícone da lhama na barra do Mac)")
    stats = {}
    with resp:
        for line in resp:
            line = line.strip()
            if not line:
                continue
            chunk = json.loads(line)
            if chunk.get("error"):
                raise RuntimeError(chunk["error"])
            piece = chunk.get("message", {}).get("content", "")
            if piece:
                yield piece
            if chunk.get("done"):
                stats = {"eval_count": chunk.get("eval_count"),
                         "eval_duration": chunk.get("eval_duration")}
    yield {"stats": stats}


# --------------------------------------------------------------------------- #
# Motores (todos 100% locais, no próprio Mac)
# --------------------------------------------------------------------------- #
ENGINES = {
    "jarvis": {"label": "Jarvis 1.0", "desc": "Mais inteligente, um pouco mais devagar"},
    "turbo": {"label": "Jarvis Turbo 1.0", "desc": "Muito rápido, ideal para coisas simples"},
    "code": {"label": "Jarvis Code 1.0", "desc": "Especialista em programação"},
}


def engine_model(engine):
    models = CFG["models"]
    return models.get(engine) or models.get("jarvis")


def engine_options(engine):
    return {"num_ctx": CFG["num_ctx_code"] if engine == "code" else CFG["num_ctx"]}


def engine_from_name(name):
    """Traduz nomes de modelo vindos da API (jarvis, jarvis-turbo, jarvis-code...)."""
    n = (name or "").lower()
    if "code" in n or "coder" in n:
        return "code"
    if "turbo" in n or "fast" in n or "mini" in n:
        return "turbo"
    return "jarvis"


def engine_stream(engine, messages, options=None):
    """Primeiro item: {"engine", "label"}; depois texto; por fim {"stats"}."""
    if engine not in ENGINES:
        engine = "jarvis"
    opts = engine_options(engine)
    opts.update(options or {})
    yield {"engine": engine, "label": ENGINES[engine]["label"]}
    for piece in ollama_stream(messages, engine_model(engine), opts):
        yield piece


def warmup(engines=("jarvis", "turbo")):
    """Carrega os modelos na memória para a primeira resposta ser rápida."""
    for _ in range(30):
        ok, _models = ollama_ok()
        if ok:
            for eng in engines:
                try:
                    with ollama_request("/api/generate", {"model": engine_model(eng), "keep_alive": CFG["keep_alive"]}, timeout=300):
                        pass
                    print(f"[jarvis] {ENGINES[eng]['label']} pronto ({engine_model(eng)})", flush=True)
                except Exception as e:
                    print(f"[jarvis] aviso ao carregar {eng}: {e}", flush=True)
            return
        time.sleep(2)


def public_link():
    try:
        text = Path(CFG["tunnel_log"]).read_text(errors="ignore")[-200_000:]
    except OSError:
        return None
    found = re.findall(r"https://[a-z0-9-]+\.trycloudflare\.com", text)
    return found[-1] if found else CFG.get("public_url") or None


def lan_links():
    import socket
    links = []
    host = socket.gethostname()
    if host:
        h = host if host.endswith(".local") else host + ".local"
        links.append(f"http://{h}:{CFG['port']}")
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
        s.close()
        links.append(f"http://{ip}:{CFG['port']}")
    except OSError:
        pass
    return links


# --------------------------------------------------------------------------- #
# HTTP
# --------------------------------------------------------------------------- #
login_attempts = {}   # ip -> [timestamps]
attempts_lock = threading.Lock()


def too_many_attempts(ip):
    now = time.time()
    with attempts_lock:
        lst = [t for t in login_attempts.get(ip, []) if now - t < 600]
        login_attempts[ip] = lst
        return len(lst) >= 10


def note_attempt(ip):
    with attempts_lock:
        login_attempts.setdefault(ip, []).append(time.time())


MIME = {".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8", ".png": "image/png", ".json": "application/json",
        ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".ico": "image/x-icon"}


class ClientGone(Exception):
    pass


class Handler(BaseHTTPRequestHandler):
    server_version = "Jarvis/" + VERSION
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        if os.environ.get("JARVIS_DEBUG"):
            sys.stderr.write("[http] " + (fmt % args) + "\n")

    # ---------- utilidades ----------
    @property
    def external(self):
        return getattr(self.server, "external", False)

    def client_ip(self):
        if self.external:
            return self.headers.get("Cf-Connecting-Ip") or self.headers.get("X-Forwarded-For", "?").split(",")[0]
        return self.client_address[0]

    def is_local_mac(self):
        return (not self.external) and self.client_address[0] in ("127.0.0.1", "::1", "::ffff:127.0.0.1")

    def cookie(self, name):
        raw = self.headers.get("Cookie")
        if not raw:
            return None
        c = cookies.SimpleCookie()
        try:
            c.load(raw)
        except cookies.CookieError:
            return None
        return c[name].value if name in c else None

    def send_json(self, code, obj, extra_headers=None):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        for k, v in (extra_headers or []):
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def consume_body(self):
        """Lê o corpo inteiro sempre (conexões keep-alive exigem isso)."""
        n = int(self.headers.get("Content-Length") or 0)
        if n > MAX_BODY:
            self.close_connection = True
            raise ValueError("pedido grande demais")
        self._raw_body = self.rfile.read(n) if n > 0 else b""

    def read_body(self):
        raw = getattr(self, "_raw_body", b"")
        if not raw:
            return {}
        data = json.loads(raw.decode("utf-8"))
        return data if isinstance(data, dict) else {}

    def device(self):
        """Retorna (token, registro) do dispositivo autenticado, ou (None, None)."""
        tok = self.cookie("jv_dev")
        with store_lock:
            if tok and tok in DEVICES:
                d = DEVICES[tok]
                d["seen"] = int(time.time())
                return tok, d
        if self.is_local_mac():
            return self.new_device(trusted=True)
        return None, None

    def new_device(self, trusted=False):
        tok = secrets.token_urlsafe(24)
        with store_lock:
            DEVICES[tok] = {"created": int(time.time()), "seen": int(time.time()), "profile": None,
                            "ua": (self.headers.get("User-Agent") or "")[:120], "local": trusted}
            save_devices()
        self._set_cookie = tok
        return tok, DEVICES[tok]

    def cookie_header(self, tok):
        https = (self.headers.get("X-Forwarded-Proto") or "").lower() == "https"
        secure = "; Secure" if (self.external and https) else ""
        return ("Set-Cookie", f"jv_dev={tok}; Path=/; Max-Age=15552000; HttpOnly; SameSite=Lax{secure}")

    def extra(self):
        tok = getattr(self, "_set_cookie", None)
        return [self.cookie_header(tok)] if tok else []

    def cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    # ---------- roteamento ----------
    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        self._dispatch("GET")

    def do_POST(self):
        self._dispatch("POST")

    def do_DELETE(self):
        self._dispatch("DELETE")

    def _dispatch(self, method):
        path = urlparse(self.path).path
        try:
            self.consume_body()
            if path.startswith("/v1/"):
                return self.openai_api(method, path)
            if path.startswith("/api/"):
                return self.api(method, path)
            if method == "GET":
                return self.static(path)
            self.send_json(404, {"error": "não encontrado"})
        except ClientGone:
            pass
        except (BrokenPipeError, ConnectionResetError):
            pass
        except Exception as e:  # noqa
            print(f"[jarvis] erro em {method} {path}: {e!r}", flush=True)
            try:
                self.send_json(500, {"error": "Erro interno: " + str(e)})
            except Exception:
                pass

    def static(self, path):
        if path in ("", "/"):
            path = "/index.html"
        f = (STATIC_DIR / path.lstrip("/")).resolve()
        if STATIC_DIR.resolve() not in f.parents or not f.is_file():
            f = STATIC_DIR / "index.html"
        body = f.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", MIME.get(f.suffix, "application/octet-stream"))
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    # ---------- API da interface ----------
    def api(self, method, path):
        if path == "/api/health":
            ok, _ = ollama_ok()
            return self.send_json(200, {"ok": True, "ollama": ok, "version": VERSION})

        if path == "/api/login" and method == "POST":
            ip = self.client_ip()
            if too_many_attempts(ip):
                return self.send_json(429, {"error": "Muitas tentativas. Espere 10 minutos."})
            body = self.read_body()
            code = (body.get("code") or "").strip().upper().replace(" ", "")
            real = CFG["family_code"].upper()
            if hmac.compare_digest(code.replace("-", ""), real.replace("-", "")):
                tok, _ = self.new_device()
                return self.send_json(200, {"ok": True}, self.extra())
            note_attempt(ip)
            return self.send_json(401, {"error": "Código incorreto."})

        tok, dev = self.device()
        if not tok:
            return self.send_json(401, {"error": "need_code"})

        if path == "/api/me":
            prof = get_profile(dev.get("profile")) if dev.get("profile") else None
            return self.send_json(200, {
                "profiles": [public_profile(p) for p in CFG["profiles"]],
                "profile": public_profile(prof) if prof else None,
                "engines": [{"id": k, **v, "model": engine_model(k)} for k, v in ENGINES.items()],
                "local": self.is_local_mac(), "version": VERSION,
            }, self.extra())

        if path == "/api/profile/select" and method == "POST":
            body = self.read_body()
            p = get_profile(body.get("id", ""))
            if not p:
                return self.send_json(404, {"error": "Perfil não encontrado."})
            ip = self.client_ip()
            with store_lock:
                if not p.get("pin_hash"):
                    # Primeiro acesso: a pessoa cria a senha do próprio perfil.
                    new = str(body.get("new_pin") or "")
                    if not new:
                        return self.send_json(428, {"error": "create_pin"})
                    if not valid_pin(new):
                        return self.send_json(400, {"error": "A senha precisa ter de 4 a 32 caracteres."})
                    p["pin_hash"] = hash_pin(new)
                    save_config()
                else:
                    if too_many_attempts(ip):
                        return self.send_json(429, {"error": "Muitas tentativas. Espere 10 minutos."})
                    if not check_pin(str(body.get("pin", "")), p["pin_hash"]):
                        note_attempt(ip)
                        return self.send_json(401, {"error": "Senha incorreta."})
                dev["profile"] = p["id"]
                save_devices()
            return self.send_json(200, {"profile": public_profile(p)}, self.extra())

        if path == "/api/profile/leave" and method == "POST":
            with store_lock:
                dev["profile"] = None
                save_devices()
            SEATS.leave(tok)
            return self.send_json(200, {"ok": True})

        prof = get_profile(dev.get("profile") or "")
        if not prof:
            return self.send_json(403, {"error": "choose_profile"})

        if path == "/api/heartbeat" and method == "POST":
            seat = SEATS.ping(tok, prof["name"], CFG["max_users"])
            running, waiting = QUEUE.snapshot()
            online, room = SEATS.online()
            seat.update({"busy_with": running, "queue": len(waiting), "online": online,
                         "room": room, "max_users": CFG["max_users"]})
            return self.send_json(200, seat)

        if path == "/api/conversations" and method == "GET":
            return self.send_json(200, {"conversations": list_conversations(prof["id"])})

        m = re.match(r"^/api/conversations/([A-Za-z0-9_-]+)$", path)
        if m:
            p = conv_path(prof["id"], m.group(1))
            if method == "GET":
                c = read_json(p, None)
                return self.send_json(200 if c else 404, c or {"error": "não encontrada"})
            if method == "DELETE":
                try:
                    p.unlink()
                except FileNotFoundError:
                    pass
                return self.send_json(200, {"ok": True})

        if path == "/api/chat" and method == "POST":
            return self.chat(tok, prof)

        if path == "/api/settings" and method == "GET":
            data = {"profile": public_profile(prof),
                    "engine_labels": {k: f"{v['label']} ({engine_model(k)})" for k, v in ENGINES.items()}}
            if prof.get("admin"):
                ok, models = ollama_ok()
                data.update({
                    "family_code": CFG["family_code"], "api_key": CFG["api_key"],
                    "public_link": public_link(), "lan_links": lan_links() if CFG["lan"] else [],
                    "models_cfg": CFG["models"], "models": models, "ollama": ok,
                    "engines": ENGINES,
                    "max_users": CFG["max_users"], "max_concurrent": CFG["max_concurrent"],
                    "profiles": [public_profile(p) for p in CFG["profiles"]],
                    "devices": len(DEVICES),
                })
            return self.send_json(200, data)

        if path == "/api/settings/profile" and method == "POST":
            body = self.read_body()
            target = get_profile(body.get("id") or prof["id"])
            if not target:
                return self.send_json(404, {"error": "Perfil não encontrado."})
            if target["id"] != prof["id"] and not prof.get("admin"):
                return self.send_json(403, {"error": "Só o administrador pode editar outros perfis."})
            with store_lock:
                if "name" in body:
                    target["name"] = str(body["name"]).strip()[:24] or target["name"]
                if "emoji" in body:
                    target["emoji"] = str(body["emoji"]).strip()[:8] or target.get("emoji", "🙂")
                if "color" in body and re.match(r"^#[0-9a-fA-F]{6}$", str(body["color"])):
                    target["color"] = body["color"]
                if body.get("pin"):
                    pin = str(body["pin"])
                    if not valid_pin(pin):
                        return self.send_json(400, {"error": "A senha precisa ter de 4 a 32 caracteres."})
                    target["pin_hash"] = hash_pin(pin)
                if body.get("reset_pin") and prof.get("admin") and target["id"] != prof["id"]:
                    # o administrador "esquece" a senha; a pessoa cria outra no próximo acesso
                    target["pin_hash"] = ""
                    for d in DEVICES.values():
                        if d.get("profile") == target["id"]:
                            d["profile"] = None
                    save_devices()
                if prof.get("admin") and "kid" in body:
                    target["kid"] = bool(body["kid"])
                save_config()
            return self.send_json(200, {"profile": public_profile(target)})

        if path == "/api/settings/admin" and method == "POST":
            if not prof.get("admin"):
                return self.send_json(403, {"error": "Apenas o administrador."})
            body = self.read_body()
            with store_lock:
                if body.get("new_family_code"):
                    CFG["family_code"] = gen_family_code()
                    # desconecta todos os aparelhos que entraram com o código antigo
                    for k in [k for k, d in DEVICES.items() if not d.get("local")]:
                        DEVICES.pop(k, None)
                    save_devices()
                if body.get("new_api_key"):
                    CFG["api_key"] = "jv-" + secrets.token_urlsafe(24)
                for eng, m in (body.get("models") or {}).items():
                    if eng in ENGINES and m:
                        CFG["models"][eng] = str(m)
                if body.get("models"):
                    threading.Thread(target=warmup, daemon=True).start()
                if "max_users" in body:
                    CFG["max_users"] = max(1, min(10, int(body["max_users"])))
                save_config()
            return self.send_json(200, {"ok": True})

        self.send_json(404, {"error": "não encontrado"})

    # ---------- streaming (SSE) ----------
    def sse_start(self, extra=None):
        self.send_response(200)
        # Não usamos text/event-stream: os túneis rápidos da Cloudflare não
        # repassam SSE. NDJSON + no-transform chega em tempo real.
        self.send_header("Content-Type", "application/x-ndjson; charset=utf-8")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "no-cache, no-transform")
        self.send_header("X-Accel-Buffering", "no")
        self.send_header("Connection", "close")
        for k, v in (extra or []):
            self.send_header(k, v)
        self.end_headers()
        self.close_connection = True

    def sse(self, event, data):
        try:
            self.wfile.write(f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n".encode())
            self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            raise ClientGone()

    def raw(self, text):
        try:
            self.wfile.write(text.encode())
            self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            raise ClientGone()

    def wait_turn(self, ticket, on_status):
        """Espera a vez na fila, avisando o cliente. Lança ClientGone se ele sair."""
        last, last_sent = None, 0
        while True:
            st = QUEUE.try_start(ticket, CFG["max_concurrent"])
            if st is None:
                return
            now = time.time()
            if st != last or now - last_sent > 5:
                on_status(st)
                last, last_sent = st, now
            QUEUE.wait(1.0)

    def chat(self, tok, prof):
        if not SEATS.is_seated(tok):
            seat = SEATS.ping(tok, prof["name"], CFG["max_users"])
            if not seat.get("seated"):
                return self.send_json(409, {"error": "seats_full", **seat})
        body = self.read_body()
        text = str(body.get("message", "")).strip()
        if not text:
            return self.send_json(400, {"error": "Mensagem vazia."})
        text = text[:20_000]
        engine = body.get("engine") if body.get("engine") in ENGINES else "jarvis"
        cid = body.get("conversation_id") or uuid.uuid4().hex[:16]
        path = conv_path(prof["id"], cid)
        with store_lock:
            conv = read_json(path, None) or {
                "id": cid, "title": (text[:48] + ("…" if len(text) > 48 else "")).replace("\n", " "),
                "created": int(time.time()), "messages": [],
                "kind": "code" if engine == "code" else "chat"}
            if conv.get("kind") == "code":
                engine = "code"
            elif engine == "code":
                engine = "jarvis"
            conv["engine"] = engine
            conv["messages"].append({"role": "user", "content": text, "t": int(time.time())})
            conv["updated"] = int(time.time())
            write_json(path, conv)

        history = conv["messages"][-CFG["history_messages"]:]
        budget, trimmed = engine_options(engine)["num_ctx"] * 2, []
        for msg in reversed(history):        # corta histórico muito longo
            budget -= len(msg["content"])
            if budget < 0 and trimmed:
                break
            trimmed.insert(0, {"role": msg["role"], "content": msg["content"]})
        messages = [{"role": "system", "content": system_prompt(prof, engine)}] + trimmed

        self.sse_start()
        self.sse("conv", {"id": cid, "title": conv["title"]})
        ticket = QUEUE.enqueue(prof["name"])
        answer, stats, status, used = [], {}, "ok", ENGINES[engine]["label"]
        try:
            self.wait_turn(ticket, lambda st: self.sse("queue", {"position": st[0], "serving": st[1]}))
            self.sse("start", {})
            for piece in engine_stream(engine, messages):
                if isinstance(piece, dict):
                    if "engine" in piece:
                        self.sse("engine", piece)
                    stats = piece.get("stats", stats)
                    continue
                answer.append(piece)
                self.sse("token", {"t": piece})
            self.sse("done", {"stats": stats})
        except ClientGone:
            status = "stopped"
        except RuntimeError as e:
            status = "error"
            try:
                self.sse("error", {"error": str(e)})
            except ClientGone:
                pass
        finally:
            QUEUE.done(ticket)
            if answer:
                with store_lock:
                    conv = read_json(path, conv)
                    msg = {"role": "assistant", "content": "".join(answer), "t": int(time.time()), "engine": engine}
                    if status == "stopped":
                        msg["stopped"] = True
                    conv["messages"].append(msg)
                    conv["updated"] = int(time.time())
                    write_json(path, conv)

    # ---------- API compatível com OpenAI (projeto Jarvis) ----------
    def openai_api(self, method, path):
        auth = self.headers.get("Authorization", "")
        key = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
        if not key or not hmac.compare_digest(key, CFG["api_key"]):
            body = json.dumps({"error": {"message": "Chave de API inválida.", "type": "invalid_api_key"}}).encode()
            self.send_response(401)
            self.cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if path == "/v1/models" and method == "GET":
            body = json.dumps({"object": "list", "data": [
                {"id": "jarvis", "object": "model", "owned_by": "jarvis-local"},
                {"id": "jarvis-turbo", "object": "model", "owned_by": "jarvis-local"},
                {"id": "jarvis-code", "object": "model", "owned_by": "jarvis-local"}]}).encode()
            self.send_response(200)
            self.cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        if path != "/v1/chat/completions" or method != "POST":
            self.send_json(404, {"error": {"message": "não encontrado"}})
            return

        req = self.read_body()
        msgs = []
        for m in req.get("messages", []):
            content = m.get("content", "")
            if isinstance(content, list):  # formato com partes
                content = "".join(p.get("text", "") for p in content if isinstance(p, dict))
            msgs.append({"role": m.get("role", "user"), "content": str(content)})
        engine = engine_from_name(req.get("model"))
        if not msgs or msgs[0]["role"] != "system":
            msgs.insert(0, {"role": "system", "content": system_prompt(None, engine)})
        options = {}
        if req.get("temperature") is not None:
            options["temperature"] = req["temperature"]
        if req.get("max_tokens"):
            options["num_predict"] = req["max_tokens"]
        stream = bool(req.get("stream"))
        cid = "chatcmpl-" + uuid.uuid4().hex[:24]
        created = int(time.time())
        name = str(req.get("user") or "Projeto Jarvis")[:24]
        ticket = QUEUE.enqueue(name)

        def chunk(delta, finish=None):
            return {"id": cid, "object": "chat.completion.chunk", "created": created, "model": req.get("model") or "jarvis",
                    "choices": [{"index": 0, "delta": delta, "finish_reason": finish}]}

        try:
            if stream:
                self.send_response(200)
                self.cors()
                self.send_header("Content-Type", "text/event-stream; charset=utf-8")
                self.send_header("Cache-Control", "no-cache, no-transform")
                self.send_header("Connection", "close")
                self.end_headers()
                self.close_connection = True
                self.wait_turn(ticket, lambda st: self.raw(f": na fila, posição {st[0]}\n\n"))
                self.raw("data: " + json.dumps(chunk({"role": "assistant", "content": ""})) + "\n\n")
                try:
                    for piece in engine_stream(engine, msgs, options):
                        if isinstance(piece, dict):
                            continue
                        self.raw("data: " + json.dumps(chunk({"content": piece}), ensure_ascii=False) + "\n\n")
                except RuntimeError as e:
                    self.raw("data: " + json.dumps({"error": {"message": str(e)}}, ensure_ascii=False) + "\n\n")
                self.raw("data: " + json.dumps(chunk({}, "stop")) + "\n\ndata: [DONE]\n\n")
            else:
                # espera sem enviar nada (o cliente aguarda a resposta completa)
                while QUEUE.try_start(ticket, CFG["max_concurrent"]) is not None:
                    QUEUE.wait(1.0)
                parts, stats = [], {}
                try:
                    for piece in engine_stream(engine, msgs, options):
                        if isinstance(piece, dict):
                            stats = piece.get("stats", stats)
                        else:
                            parts.append(piece)
                except RuntimeError as e:
                    body = json.dumps({"error": {"message": str(e)}}, ensure_ascii=False).encode()
                    self.send_response(502)
                    self.cors()
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                    return
                out = {"id": cid, "object": "chat.completion", "created": created, "model": req.get("model") or "jarvis",
                       "choices": [{"index": 0, "finish_reason": "stop",
                                    "message": {"role": "assistant", "content": "".join(parts)}}],
                       "usage": {"completion_tokens": stats.get("eval_count") or 0}}
                body = json.dumps(out, ensure_ascii=False).encode()
                self.send_response(200)
                self.cors()
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
        finally:
            QUEUE.done(ticket)


class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    global CFG, DEVICES
    HOME.mkdir(parents=True, exist_ok=True)
    CFG = load_config()
    DEVICES = read_json(DEVICES_PATH, {})

    host = "0.0.0.0" if CFG["lan"] else "127.0.0.1"
    main_srv = Server((host, CFG["port"]), Handler)
    main_srv.external = False
    ext_srv = Server(("127.0.0.1", CFG["external_port"]), Handler)
    ext_srv.external = True

    threading.Thread(target=ext_srv.serve_forever, daemon=True).start()
    threading.Thread(target=warmup, daemon=True).start()
    print(f"[jarvis] Jarvis {VERSION} pronto em http://localhost:{CFG['port']}  (modelos: {CFG['models']})", flush=True)
    print(f"[jarvis] dados em: {HOME}", flush=True)
    try:
        main_srv.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
