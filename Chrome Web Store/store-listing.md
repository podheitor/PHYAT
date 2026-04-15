# PHYAT — Chrome Web Store Listing Content

---

## Name (max 45 chars)
PHYAT - YouTube Automation Tools

---

## Short Description (max 132 chars)
Automate comments, live chat messages, and related videos on YouTube. No API key required.

---

## Full Description (EN) — max 16,000 chars

PHYAT (PodHeitor YouTube Automation Tools) is a powerful browser extension for YouTube creators that automates repetitive tasks — saving hours of manual work.

**⚠️ IMPORTANT: This extension is designed for creators to manage their own channel. Use responsibly and within YouTube's Terms of Service.**

---

### 🖊️ Auto Comments
Automatically add comments to all videos on your channel.

- Choose content types: Videos, Live streams, or Shorts
- Skip videos that already have your comment (only comment on new ones)
- Auto-like the video before commenting
- Configurable delay between comments to avoid spam detection
- Supports all videos via YouTube continuation API (no limit on channel size)
- Live progress overlay with real-time counter
- Stop button to cancel the run at any time

### 💬 Auto Live Chat Messages
Send pre-configured messages in YouTube live streams on a schedule.

- Add unlimited messages (one per line)
- Set interval: 10 seconds to 1 hour
- Recurring mode: loops through all messages continuously
- Random order option
- Start/stop at any time without refreshing the page

### 🤖 AI Auto-Reply (Live Chat)
Let an AI model reply automatically to viewers in your live chat.

- Compatible with any OpenAI-compatible API
- Supports: Groq (recommended — free tier), OpenAI, Anthropic Claude, or local Ollama
- Fetch available models directly from your API endpoint
- Customize the AI persona with a system prompt
- Rolling conversation history for coherent replies
- Configurable minimum delay between AI replies
- Test API button to verify your connection before going live

### 🔗 Bulk Related Video
Set the "Related Video" field on multiple YouTube Studio videos simultaneously.

- Select multiple videos with checkboxes in YouTube Studio
- Pick a single related video and apply it to all selected videos at once
- No more manual one-by-one editing

---

### How It Works
- Works entirely within your browser using your existing YouTube session
- No Google Cloud setup, no OAuth authorization, no external login required
- Persistent task state: the Auto Comments feature survives page navigations using local browser storage
- Content scripts inject only on the relevant pages (YouTube + YouTube Studio)

---

### Privacy
- No data is sent to any external server by this extension itself
- AI Auto-Reply optionally makes calls to your configured LLM API (controlled entirely by you)
- No analytics, no telemetry, no tracking

---

## Full Description (PT-BR)

PHYAT (PodHeitor YouTube Automation Tools) é uma extensão para criadores do YouTube que automatiza tarefas repetitivas — economizando horas de trabalho manual.

**⚠️ IMPORTANTE: Esta extensão foi criada para criadores gerenciarem seu próprio canal. Use de forma responsável e dentro dos Termos de Serviço do YouTube.**

---

### 🖊️ Auto Comentários
Adicione comentários automaticamente a todos os vídeos do seu canal.

- Escolha o tipo de conteúdo: Vídeos, Lives ou Shorts
- Pule vídeos que já têm seu comentário
- Curta automaticamente o vídeo antes de comentar
- Delay configurável entre comentários para evitar bloqueios
- Suporte a canais grandes via API de paginação do YouTube
- Overlay de progresso em tempo real com botão de parar

### 💬 Auto Mensagens no Live Chat
Envie mensagens pré-configuradas no chat ao vivo em intervalos regulares.

- Mensagens ilimitadas (uma por linha)
- Intervalo de 10 segundos a 1 hora
- Modo recorrente: repete as mensagens continuamente
- Ordem aleatória opcional

### 🤖 AI Auto-Resposta (Live Chat)
Deixe uma IA responder automaticamente aos espectadores no chat ao vivo.

- Compatível com qualquer API OpenAI-compatible
- Suporte: Groq (recomendado — grátis), OpenAI, Anthropic Claude, Ollama local
- Busca os modelos disponíveis diretamente da sua API
- Persona personalizável via prompt de sistema
- Histórico de conversa para respostas coerentes
- Delay mínimo configurável entre respostas
- Botão de teste para verificar a conexão antes de usar

### 🔗 Vídeo Relacionado em Massa
Defina o campo "Vídeo Relacionado" em múltiplos vídeos do YouTube Studio de uma vez.

---

### Como Funciona
- Funciona diretamente no seu navegador com sua sessão do YouTube existente
- Sem configuração de Google Cloud, sem OAuth, sem login externo
- Estado persistente: o Auto Comentários sobrevive às navegações de página

---

### Privacidade
- Nenhum dado é enviado para servidores externos pela extensão
- A AI Auto-Resposta faz chamadas à API LLM configurada por você (totalmente no seu controle)
- Sem analytics, sem telemetria, sem rastreamento

---

## Category
Productivity

## Language
Portuguese (Brazil) + English

## Tags / Keywords
youtube automation, auto comment, live chat bot, youtube studio, bulk edit, ai chat, youtube creator tools

---

## Screenshot Notes (Google requires 1280×800 or 640×400 px)

Current screenshot dimensions:
- auto-comments.png: 692×911 px ⚠️ Height exceeds 800px — needs resize
- live-chat.png: 960×715 px ⚠️ Check if accepted (not standard size)
- related-video.png: 522×531 px ⚠️ Non-standard size

**Recommended:** Retake screenshots at 1280×800 (fullscreen browser, 1280px wide) or resize existing ones.

To resize quickly:
  mogrify -resize 1280x800\! docs/screenshots/auto-comments.png
  (⚠️ use \! to force exact size, may distort — better to retake at correct resolution)

---

## Submission Checklist

- [ ] Google Developer Account ($5 one-time fee) → chrome.google.com/webstore/devconsole
- [ ] Upload PHYAT-extension.zip
- [ ] Fill in name, short desc, full desc from this file
- [ ] Set Category: Productivity
- [ ] Upload screenshots (fix dimensions first)
- [ ] Policy declaration: single purpose (creator automation for own channel)
- [ ] Submit for review (typically 1–3 business days)

