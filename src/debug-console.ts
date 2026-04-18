type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
}

const MAX_ENTRIES = 200

let installed = false

export function installDebugConsole(
  output: HTMLElement,
  clearButton?: HTMLButtonElement | null,
) {
  if (installed) return
  installed = true

  const entries: LogEntry[] = []
  render(entries, output)

  clearButton?.addEventListener('click', () => {
    entries.length = 0
    render(entries, output)
  })

  const original = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  }

  const methods: LogLevel[] = ['log', 'info', 'warn', 'error', 'debug']
  for (const level of methods) {
    const passthrough = original[level]
    console[level] = ((...args: unknown[]) => {
      pushEntry(entries, output, level, args)
      passthrough(...args)
    }) as Console[typeof level]
  }

  window.addEventListener('error', (event) => {
    const detail = event.error ?? event.message
    pushEntry(entries, output, 'error', ['Uncaught error', detail])
  })

  window.addEventListener('unhandledrejection', (event) => {
    pushEntry(entries, output, 'error', ['Unhandled promise rejection', event.reason])
  })
}

function pushEntry(
  entries: LogEntry[],
  output: HTMLElement,
  level: LogLevel,
  args: unknown[],
) {
  entries.push({
    level,
    message: args.map(formatValue).join(' '),
    timestamp: new Date().toLocaleTimeString([], {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  })
  if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES)
  render(entries, output)
}

function render(entries: LogEntry[], output: HTMLElement) {
  output.replaceChildren()

  if (!entries.length) {
    const empty = document.createElement('div')
    empty.className = 'debug-empty'
    empty.textContent = 'No logs yet.'
    output.append(empty)
    return
  }

  for (const entry of entries) {
    const row = document.createElement('div')
    row.className = `debug-entry debug-${entry.level}`

    const time = document.createElement('span')
    time.className = 'debug-time'
    time.textContent = entry.timestamp

    const level = document.createElement('span')
    level.className = 'debug-level'
    level.textContent = entry.level

    const message = document.createElement('span')
    message.className = 'debug-message'
    message.textContent = entry.message

    row.append(time, level, message)
    output.append(row)
  }

  output.scrollTop = output.scrollHeight
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'function') return `[Function ${value.name || 'anonymous'}]`
  if (typeof value === 'object') return stringify(value)
  return String(value)
}

function stringify(value: object): string {
  const seen = new WeakSet<object>()
  try {
    return JSON.stringify(
      value,
      (_key, next: unknown) => {
        if (next instanceof Error) {
          return {
            name: next.name,
            message: next.message,
            stack: next.stack,
          }
        }
        if (typeof next === 'bigint') return `${next}n`
        if (typeof next === 'object' && next !== null) {
          if (seen.has(next)) return '[Circular]'
          seen.add(next)
        }
        return next
      },
      2,
    )
  } catch {
    return Object.prototype.toString.call(value)
  }
}
