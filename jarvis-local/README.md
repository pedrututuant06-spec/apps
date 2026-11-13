# Jarvis Local

Assistente de IA **100% no seu Mac**: grátis, sem limite de mensagens e independente (não depende de nenhuma empresa nem de internet).

| Modo | Para quê | Modelo (Mac com 8 GB) | Modelo (16 GB) | Modelo (24 GB) |
|---|---|---|---|---|
| 🧠 **Jarvis 1.0** | Mais inteligente, um pouco mais devagar | gemma3:4b | gemma3:12b | gemma3:12b |
| ⚡ **Jarvis Turbo 1.0** | Muito rápido, para coisas simples | gemma3:1b | gemma3:4b | gemma3:4b |
| `</>` **Jarvis Code 1.0** | Programação | qwen2.5-coder:3b | qwen2.5-coder:7b | qwen2.5-coder:14b |

O instalador detecta sozinho a memória RAM do Mac e escolhe os modelos que não travam o computador.

## O que vem pronto

- **App Jarvis** no Mac, com o seu ícone, no Dock e no Launchpad.
- Duas áreas: **💬 Conversas** (com o seletor Jarvis 1.0 / Turbo 1.0) e **`</>` Jarvis Code**, com botão de copiar código.
- **4 perfis com senha**: no primeiro acesso cada pessoa cria a sua senha, e as conversas de um não aparecem para os outros. O perfil marcado como "criança/jovem" faz o Jarvis usar linguagem simples e conteúdo adequado à idade.
- **Fila**: no máximo 4 pessoas conectadas. A 5ª vê "Espere um momento… você é o 1º da fila" e entra sozinha quando uma vaga abre. Quando o Jarvis está respondendo outra pessoa, aparece: "o Jarvis está respondendo a Ana. Você é o 1º da fila".
- **Wi-Fi de casa**: celulares e tablets acessam `http://NOME-DO-MAC.local:8080` (e podem "Adicionar à Tela de Início").
- **Link para usar fora de casa** (opcional): um endereço `https://….trycloudflare.com`, protegido pelo código da família.
- **API para o projeto Jarvis**, compatível com OpenAI, para usar a IA local no lugar do Gemini ou do Claude.
- Inicia sozinho quando o Mac liga.

## Instalação (uma vez só)

1. Baixe esta pasta para o Mac (no GitHub: **Code › Download ZIP**) e descompacte.
2. Abra o **Terminal** (Cmd + Espaço, digite "Terminal") e rode:
   ```bash
   cd ~/Downloads/apps-*/jarvis-local && bash scripts/install.sh
   ```
   (Também dá para clicar duas vezes em **`Instalar Jarvis.command`**. Se o macOS bloquear, clique com o botão direito › Abrir.)
3. Responda às perguntas (Enter = sim). Baixar os modelos leva de 5 a 30 minutos, dependendo da internet.
4. No fim o app **Jarvis** abre. Toque em **Pessoa 1**, crie sua senha e, em ⚙️, coloque os nomes da família.

Espaço necessário: cerca de 9 GB (Mac com 8 GB), 20 GB (16 GB) ou 24 GB (24 GB). Se faltar espaço, o instalador oferece o **assistente de limpeza**, que pergunta antes de apagar cada coisa. Ele também pode ser aberto depois com `jarvis limpar`.

## Comandos no Terminal

```
jarvis status        se está tudo funcionando
jarvis link          link para usar fora de casa (já copia)
jarvis codigo        código da família
jarvis api           dados para conectar o projeto Jarvis
jarvis reiniciar     reinicia o servidor
jarvis modelo        mostra os modelos; ex.: jarvis modelo turbo gemma3:4b
jarvis acelerar      deixa o Jarvis o mais rápido possível
jarvis limpar        libera espaço no Mac
jarvis desinstalar   remove tudo
```

Também dá para conversar direto no Terminal: `ollama run jarvis`, `ollama run jarvis-turbo` e `ollama run jarvis-code`.

## Conectar o projeto Jarvis

| Campo | Valor |
|---|---|
| URL base | `http://localhost:8080/v1` (ou `https://SEU-LINK.trycloudflare.com/v1`) |
| Chave | em ⚙️ › Integração ou `jarvis api` |
| Modelo | `jarvis`, `jarvis-turbo` ou `jarvis-code` |

Exemplo:
```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer SUA-CHAVE" -H "Content-Type: application/json" \
  -d '{"model":"jarvis","messages":[{"role":"user","content":"Oi, Jarvis!"}]}'
```
Funciona com qualquer biblioteca da OpenAI: basta trocar o `base_url` e a `api_key`.

## Bom saber

- **Seja realista com a qualidade**: modelos que cabem num Mac M2 são bons para o dia a dia, mas não chegam ao nível do Claude, do GPT ou do Gemini, que rodam em supercomputadores. Para coisas simples use o **Turbo**; para tarefas que exigem mais raciocínio, o **Jarvis 1.0**; para programar, o **Code**.
- O Mac precisa estar **ligado e acordado** para a família usar. O instalador pode impedir que ele durma quando estiver na tomada. Com a tampa fechada, o Mac dorme, a menos que esteja ligado a um monitor.
- O **link externo** muda quando o Mac reinicia. Pegue o novo em ⚙️ ou com `jarvis link`.
- Se o macOS perguntar se o "python3" pode aceitar conexões de entrada, clique em **Permitir** (é o que libera o acesso pelo Wi-Fi).
- Os dados ficam em `~/Library/Application Support/Jarvis` e os registros em `~/Library/Logs/Jarvis`.
