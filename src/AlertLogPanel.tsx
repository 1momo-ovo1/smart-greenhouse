import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { Bell, Plus } from 'lucide-react'

export type LogLevel = 'info' | 'warning' | 'danger'

export interface LogEntry {
  id: string
  time: string
  level: LogLevel
  message: string
}

export interface AlertLogPanelRef {
  addLog: (time: string, level: LogLevel, message: string) => void
}

const MAX_LOGS = 20

const LEVEL_STYLES: Record<LogLevel, string> = {
  info: 'text-blue-500 bg-blue-50 border-blue-200',
  warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
  danger: 'text-red-500 bg-red-50 border-red-200',
}

const LEVEL_LABELS: Record<LogLevel, string> = {
  info: 'INFO',
  warning: 'WARN',
  danger: 'DANGER',
}

// 模拟告警消息池
const MOCK_MESSAGES: Record<LogLevel, string[]> = {
  info: [
    '系统启动完成，所有服务正常',
    '传感器数据同步成功',
    '自动灌溉程序已启动',
    '环境参数在正常范围内',
    '数据备份完成',
  ],
  warning: [
    '空气湿度低于阈值，建议检查',
    '土壤湿度偏低，请注意',
    '光照强度不足，建议补光',
    '温度接近上限，请注意通风',
    '水位偏低，请及时补水',
  ],
  danger: [
    '温度超过危险阈值！',
    '湿度严重不足，作物可能受损！',
    '土壤干旱，急需灌溉！',
    '光照严重不足，影响光合作用！',
    '水位过低，灌溉系统可能空转！',
  ],
}

// 生成模拟初始数据
const generateInitialLogs = (): LogEntry[] => {
  const now = Date.now()
  const logs: LogEntry[] = [
    {
      id: 'init-1',
      time: formatTime(new Date(now - 4000)),
      level: 'info',
      message: '系统初始化完成',
    },
    {
      id: 'init-2',
      time: formatTime(new Date(now - 3000)),
      level: 'info',
      message: '传感器连接正常',
    },
    {
      id: 'init-3',
      time: formatTime(new Date(now - 2000)),
      level: 'warning',
      message: '空气湿度略低于阈值',
    },
    {
      id: 'init-4',
      time: formatTime(new Date(now - 1000)),
      level: 'info',
      message: '自动模式已启用',
    },
  ]
  return logs
}

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const AlertLogPanel = forwardRef<AlertLogPanelRef>((_, ref) => {
  const [logs, setLogs] = useState<LogEntry[]>(generateInitialLogs)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 自动滚动到最新日志
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  // 暴露 addLog 方法给父组件
  useImperativeHandle(ref, () => ({
    addLog: (time: string, level: LogLevel, message: string) => {
      const newLog: LogEntry = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        time,
        level,
        message,
      }
      setLogs((prev) => {
        const updated = [...prev, newLog]
        // 超过最大数量时移除最早的
        if (updated.length > MAX_LOGS) {
          return updated.slice(updated.length - MAX_LOGS)
        }
        return updated
      })
    },
  }))

  // 新增模拟告警
  const handleAddMockLog = () => {
    const levels: LogLevel[] = ['info', 'warning', 'danger']
    const randomLevel = getRandomItem(levels)
    const randomMessage = getRandomItem(MOCK_MESSAGES[randomLevel])
    const currentTime = formatTime(new Date())

    // 通过 ref 方式调用 addLog（模拟外部调用）
    // 这里直接操作 state 也可以，但为了演示 addLog 接口，我们直接设置
    const newLog: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      time: currentTime,
      level: randomLevel,
      message: randomMessage,
    }
    setLogs((prev) => {
      const updated = [...prev, newLog]
      if (updated.length > MAX_LOGS) {
        return updated.slice(updated.length - MAX_LOGS)
      }
      return updated
    })
  }

  return (
    <div className="bg-white rounded-xl border border-[#E5EFE8] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold text-gray-800 flex items-center gap-2 uppercase tracking-wider">
          <Bell size={14} />
          Alert Log
          <span className="text-gray-400 font-normal normal-case tracking-normal">
            ({logs.length}/{MAX_LOGS})
          </span>
        </h2>
        <button
          onClick={handleAddMockLog}
          className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-medium hover:bg-emerald-100 transition-colors"
        >
          <Plus size={12} />
          新增模拟告警
        </button>
      </div>

      {/* Log List */}
      <div
        ref={scrollRef}
        className="h-[80px] overflow-y-auto space-y-1 pr-1 scrollbar-thin"
      >
        {logs.map((log) => (
          <div key={log.id} className="flex items-center gap-2 text-sm">
            <span className="text-gray-400 font-mono text-xs shrink-0 w-[60px]">
              {log.time}
            </span>
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border shrink-0 ${LEVEL_STYLES[log.level]}`}
            >
              {LEVEL_LABELS[log.level]}
            </span>
            <span className="text-gray-600 text-sm truncate">{log.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
})

AlertLogPanel.displayName = 'AlertLogPanel'

export default AlertLogPanel
