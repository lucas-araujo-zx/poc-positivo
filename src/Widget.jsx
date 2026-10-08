import { useEffect, useRef } from 'react'

const HOST_ID = 'positivo-widget-host'

const STATIC_ATTRIBUTES = {
  variant: 'expanded',
  dismissible: 'true',
  transcript: 'true',
  'text-input': 'true',
  'strip-audio-tags': 'true',
  'action-text': 'Falar agora',
  'start-call-text': 'Iniciar conversa',
  'end-call-text': 'Encerrar',
  'expand-text': 'Abrir assistente',
  'listening-text': 'Ouvindo...',
  'speaking-text': 'Agente falando',
  'avatar-orb-color-1': '#1e4f91',
  'avatar-orb-color-2': '#9ce6e6',
}

function conversationIdFromUnknown(value) {
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }
  if (!value || typeof value !== 'object') {
    return ''
  }
  for (const key of ['conversationId', 'conversation_id', 'id']) {
    const candidate = value[key]
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }
  return ''
}

function preferConversationId(...candidates) {
  const values = candidates.map((value) => value?.trim() ?? '').filter(Boolean)
  return (
    values.find((value) => /^conv_/i.test(value)) ??
    values.find((value) => !/^agent_/i.test(value)) ??
    ''
  )
}

function readWidgetConversationId(widget, fallback) {
  const host = widget
  const shadowText = widget.shadowRoot?.textContent ?? ''
  const fromShadow = shadowText.match(/conv_[A-Za-z0-9]+/i)?.[0]
  return preferConversationId(
    fallback,
    host.getConversationId?.(),
    host.conversationId,
    widget.getAttribute('conversation-id') ?? undefined,
    fromShadow,
    host.getId?.(),
  )
}

function isElementVisible(element) {
  if (typeof element.checkVisibility === 'function') {
    return element.checkVisibility({
      checkOpacity: true,
      checkVisibilityCSS: true,
    })
  }
  const style = window.getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
}

function nodeCallLabel(node) {
  return [node.getAttribute('aria-label'), node.textContent]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function shadowHasEndCallButton(root) {
  if (!root) {
    return false
  }
  for (const node of root.querySelectorAll('button, [role="button"]')) {
    const label = nodeCallLabel(node)
    const isEnd =
      label === 'end' ||
      label === 'encerrar' ||
      label.startsWith('end call') ||
      label.includes('encerrar')
    if (isEnd && isElementVisible(node)) {
      return true
    }
  }
  return false
}

const hangupListeners = new Set()
let socketHooked = false

function hookConvaiSockets() {
  if (socketHooked || typeof window.WebSocket !== 'function') {
    return
  }
  socketHooked = true
  const Original = window.WebSocket
  class ConvaiWebSocket extends Original {
    constructor(url, protocols) {
      super(url, protocols)
      if (!/elevenlabs\.io|convai/i.test(String(url))) {
        return
      }
      let opened = false
      this.addEventListener('open', () => {
        opened = true
      })
      this.addEventListener('close', () => {
        if (!opened) {
          return
        }
        hangupListeners.forEach((listener) => listener())
      })
    }
  }
  window.WebSocket = ConvaiWebSocket
}

function observeWidgetHangup(widget, onHangup) {
  hookConvaiSockets()
  let sawInCall = false
  let stopped = false
  const fire = () => {
    if (stopped) {
      return
    }
    stopped = true
    onHangup()
  }
  const check = () => {
    if (stopped) {
      return
    }
    const inCall = shadowHasEndCallButton(widget.shadowRoot)
    if (inCall) {
      sawInCall = true
      return
    }
    if (sawInCall) {
      fire()
    }
  }
  const onSocketClose = () => fire()
  hangupListeners.add(onSocketClose)
  const observer = new MutationObserver(check)
  const attach = () => {
    if (widget.shadowRoot) {
      observer.observe(widget.shadowRoot, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
      })
    }
  }
  attach()
  const interval = window.setInterval(() => {
    attach()
    check()
  }, 400)
  return () => {
    stopped = true
    hangupListeners.delete(onSocketClose)
    observer.disconnect()
    window.clearInterval(interval)
  }
}

export function Widget({ signedUrl, variables, onEnded }) {
  const variablesRef = useRef(variables)
  const onEndedRef = useRef(onEnded)
  variablesRef.current = variables
  onEndedRef.current = onEnded
  const variablesJson = JSON.stringify(variables)

  useEffect(() => {
    let host = document.getElementById(HOST_ID)
    if (!host) {
      host = document.createElement('div')
      host.id = HOST_ID
      document.body.appendChild(host)
    }
    let widget = host.querySelector('elevenlabs-convai')
    if (!widget) {
      widget = document.createElement('elevenlabs-convai')
      host.appendChild(widget)
    }
    for (const [name, value] of Object.entries(STATIC_ATTRIBUTES)) {
      widget.setAttribute(name, value)
    }
    widget.setAttribute('signed-url', signedUrl)
    widget.setAttribute('dynamic-variables', JSON.stringify(variablesRef.current))

    let conversationId = ''
    let sessionStarted = false
    let ended = false
    let stopHangupWatch

    const finish = (nextId) => {
      const resolvedId = readWidgetConversationId(widget, nextId || conversationId)
      if (ended || (!sessionStarted && !/^conv_/i.test(resolvedId))) {
        return
      }
      ended = true
      stopHangupWatch?.()
      if (/^conv_/i.test(resolvedId)) {
        onEndedRef.current?.(resolvedId)
      }
    }

    const onCall = (event) => {
      const detail = event.detail ?? {}
      conversationId = detail.conversationId?.trim() || conversationId
      ended = false
      sessionStarted = true
      stopHangupWatch?.()
      stopHangupWatch = observeWidgetHangup(widget, () => finish(conversationId))
      const config = detail.config
      if (!config) {
        return
      }
      config.dynamicVariables = variablesRef.current
      const previousConnect = config.onConnect
      config.onConnect = (info) => {
        conversationId = info?.conversationId?.trim() || conversationId
        previousConnect?.(info)
      }
      const previousDisconnect = config.onDisconnect
      config.onDisconnect = (details) => {
        previousDisconnect?.(details)
        finish(conversationIdFromUnknown(details) || conversationId)
      }
      const previousStatus = config.onStatusChange
      config.onStatusChange = (info) => {
        previousStatus?.(info)
        if (info?.status === 'disconnected') {
          finish(conversationId)
        }
      }
    }

    widget.addEventListener('elevenlabs-convai:call', onCall)
    return () => {
      stopHangupWatch?.()
      widget.removeEventListener('elevenlabs-convai:call', onCall)
      host.remove()
    }
  }, [signedUrl])

  useEffect(() => {
    document
      .querySelector(`#${HOST_ID} elevenlabs-convai`)
      ?.setAttribute('dynamic-variables', variablesJson)
  }, [variablesJson])

  return null
}
