import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import AlertLogPanel, { type AlertLogPanelRef } from './AlertLogPanel'
import {
  ArrowLeft,
  Thermometer,
  Droplets,
  Sprout,
  Sun,
  Wind,
  Fan,
  Power,
  Settings,
  TrendingUp,
  Leaf,
  Bell,
  Check,
  Plus,
  Download,
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts'
import {
  VEGETABLE_PROFILES,
  type SensorData,
  type ActuatorState,
  type ThresholdConfig,
} from './services/onenet'

const SENSOR_ICONS: Record<string, React.ReactNode> = {
  thermometer: <Thermometer size={18} />,
  droplets: <Droplets size={18} />,
  sprout: <Sprout size={18} />,
  sun: <Sun size={18} />,
  waves: <Droplets size={18} />,
  bell: <Bell size={18} />,
  fan: <Fan size={18} />
}

// 水位距离阈值（cm）：距离越大代表水位越低，超过此值表示缺水
const WATER_DISTANCE_THRESHOLD = 20

const INITIAL_ACTUATORS: ActuatorState[] = [
  { id: 'buzzer', name: 'Buzzer', status: false, icon: 'bell' },
  { id: 'humidifier', name: 'Humidifier', status: false, icon: 'droplets' },
  { id: 'irrigation', name: 'Irrigation', status: false, icon: 'sprout' },
  { id: 'light', name: 'Grow Light', status: false, icon: 'sun' },
  { id: 'fan', name: 'Fan', status: false, icon: 'fan' },
]

interface Crop {
  id: string
  name: string
  thresholds: ThresholdConfig
  description: string
}

// 扩展阈值配置，包含水位目标
interface ExtendedThresholdConfig extends ThresholdConfig {
  waterTarget: number
}

// 生成初始传感器数据
function generateInitialSensorData(): SensorData[] {
  const now = Date.now()
  return [
    { id: 'air_temperature', name: 'Air Temperature', value: 25.6, unit: '°C', timestamp: now, icon: 'thermometer' },
    { id: 'air_humidity', name: 'Air Humidity', value: 60.2, unit: '%', timestamp: now, icon: 'droplets' },
    { id: 'soil_moisture', name: 'Soil Moisture', value: 52.8, unit: '%', timestamp: now, icon: 'sprout' },
    { id: 'light_intensity', name: 'Light Intensity', value: 12.5, unit: 'klx', timestamp: now, icon: 'sun' },
    { id: 'water_level', name: 'Water Level', value: 15.3, unit: 'cm', timestamp: now, icon: 'waves' },
  ]
}

// 生成初始历史数据
function generateInitialHistoryData(): { timestamp: number; value: number }[] {
  const data: { timestamp: number; value: number }[] = []
  const now = Date.now()
  const interval = (24 * 3600000) / 48

  for (let i = 0; i < 48; i++) {
    const timestamp = now - 24 * 3600000 + i * interval
    const baseValue = 20 + Math.sin(i / 6) * 5
    const noise = (Math.random() - 0.5) * 2
    data.push({ timestamp, value: baseValue + noise })
  }

  return data
}

export default function GreenhouseDashboard() {
  const navigate = useNavigate()
  const [crops, setCrops] = useState<Crop[]>(VEGETABLE_PROFILES)
  const [selectedCrop, setSelectedCrop] = useState<Crop>(VEGETABLE_PROFILES[0])
  const [customCropName, setCustomCropName] = useState('')
  const [sensorData, setSensorData] = useState<SensorData[]>(generateInitialSensorData)
  const [actuators, setActuators] = useState<ActuatorState[]>(INITIAL_ACTUATORS)
  const [thresholds, setThresholds] = useState<ExtendedThresholdConfig>({
    ...VEGETABLE_PROFILES[0].thresholds,
    lightMin: 12,
    waterTarget: WATER_DISTANCE_THRESHOLD,
  })
  const [historyData, setHistoryData] = useState<{ timestamp: number; value: number }[]>(generateInitialHistoryData)
  const [activeChart, setActiveChart] = useState<string>('air_temperature')
  const [autoMode, setAutoMode] = useState(true)
  const [showToast, setShowToast] = useState(false)
  const logPanelRef = useRef<AlertLogPanelRef>(null)

  // 组件挂载 3 秒后自动添加一条"系统启动"日志
  useEffect(() => {
    const timer = setTimeout(() => {
      const now = new Date()
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
      logPanelRef.current?.addLog(timeStr, 'info', '系统启动完成，所有服务正常运行')
    }, 3000)
    return () => clearTimeout(timer)
  }, [])

  // 每 3 秒更新本地传感器数据（纯 Mock，无网络请求）
  useEffect(() => {
    const interval = setInterval(() => {
      setSensorData((prev) =>
        prev.map((sensor) => {
          let fluctuation = (Math.random() - 0.5) * 2
          let newValue = sensor.value + fluctuation

          // 根据传感器类型限制范围
          switch (sensor.id) {
            case 'air_temperature':
              newValue = Math.max(15, Math.min(40, newValue))
              break
            case 'air_humidity':
              newValue = Math.max(30, Math.min(95, newValue))
              break
            case 'soil_moisture':
              newValue = Math.max(20, Math.min(90, newValue))
              break
            case 'light_intensity':
              newValue = Math.max(0, Math.min(30, newValue))
              break
            case 'water_level':
              newValue = Math.max(5, Math.min(50, newValue))
              break
          }

          return { ...sensor, value: newValue, timestamp: Date.now() }
        })
      )
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // 添加自定义作物
  const handleAddCrop = () => {
    if (customCropName.trim()) {
      const newCrop: Crop = {
        id: `custom-${Date.now()}`,
        name: customCropName.trim(),
        thresholds: { airTempMax: 25, airHumidityMin: 60, soilMoistureMin: 50, lightMin: 8000 },
        description: 'Custom crop',
      }
      setCrops((prev) => [...prev, newCrop])
      setCustomCropName('')
    }
  }

  // 选择作物
  const handleSelectCrop = (crop: Crop) => {
    setSelectedCrop(crop)
    setThresholds({
      ...crop.thresholds,
      // 作物档案中的光照阈值单位是 lux，滑杆使用 klx，这里统一为 klx
      lightMin: crop.thresholds.lightMin > 30 ? crop.thresholds.lightMin / 1000 : crop.thresholds.lightMin,
      // 补上作物档案里没有的 waterTarget
      waterTarget: WATER_DISTANCE_THRESHOLD,
    })
  }

  // 切换执行器
  const toggleActuator = (id: string) => {
    const newStatus = !actuators.find((a) => a.id === id)?.status
    setActuators((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a))
    )
  }

  // 更新阈值
  const updateThreshold = (key: keyof ExtendedThresholdConfig, value: number) => {
    setThresholds((prev) => ({ ...prev, [key]: value }))
  }

  // 保存阈值
  const handleSaveThresholds = () => {
    setShowToast(true)
    setTimeout(() => setShowToast(false), 2000)
  }

  // 检查传感器是否超出阈值
  const getAlertStatus = (sensorId: string): 'normal' | 'warning' | 'danger' => {
    const sensor = sensorData.find((s) => s.id === sensorId)
    if (!sensor) return 'normal'

    switch (sensorId) {
      case 'air_temperature':
        return sensor.value > thresholds.airTempMax ? 'danger' : sensor.value > thresholds.airTempMax - 3 ? 'warning' : 'normal'
      case 'air_humidity':
        return sensor.value < thresholds.airHumidityMin ? 'danger' : sensor.value < thresholds.airHumidityMin + 5 ? 'warning' : 'normal'
      case 'soil_moisture':
        return sensor.value < thresholds.soilMoistureMin ? 'danger' : sensor.value < thresholds.soilMoistureMin + 5 ? 'warning' : 'normal'
      case 'light_intensity':
        return sensor.value < thresholds.lightMin ? 'danger' : sensor.value < thresholds.lightMin + 1000 ? 'warning' : 'normal'
      default:
        return 'normal'
    }
  }

  // 获取 Y 轴最大值
  const getYAxisMax = (sensorId: string): number => {
    switch (sensorId) {
      case 'air_temperature':
        return 50
      case 'air_humidity':
        return 100
      case 'soil_moisture':
        return 100
      case 'light_intensity':
        return 30
      case 'water_level':
        return 100
      default:
        return 100
    }
  }

  // 获取 Y 轴刻度数量（光照更精细）
  const getYAxisCount = (sensorId: string): number => {
    switch (sensorId) {
      case 'light_intensity':
        return 10
      default:
        return 5
    }
  }

  // 获取 Y 轴单位
  const getYAxisUnit = (sensorId: string): string => {
    switch (sensorId) {
      case 'air_temperature':
        return '°C'
      case 'air_humidity':
        return '%'
      case 'soil_moisture':
        return '%'
      case 'light_intensity':
        return ' klx'
      case 'water_level':
        return ' cm'
      default:
        return ''
    }
  }

  // 获取阈值参考线
  const getThresholdLine = (sensorId: string): boolean => {
    return ['air_temperature', 'air_humidity', 'soil_moisture', 'light_intensity', 'water_level'].includes(sensorId)
  }

  // 获取阈值
  const getThresholdValue = (sensorId: string): number => {
    switch (sensorId) {
      case 'air_temperature':
        return thresholds.airTempMax
      case 'air_humidity':
        return thresholds.airHumidityMin
      case 'soil_moisture':
        return thresholds.soilMoistureMin
      case 'light_intensity':
        return thresholds.lightMin
      case 'water_level':
        return thresholds.waterTarget
      default:
        return 0
    }
  }

  // 获取阈值标签
  const getThresholdLabel = (sensorId: string): string => {
    switch (sensorId) {
      case 'air_temperature':
        return `Threshold: ${thresholds.airTempMax}°C`
      case 'air_humidity':
        return `Threshold: ${thresholds.airHumidityMin}%`
      case 'soil_moisture':
        return `Threshold: ${thresholds.soilMoistureMin}%`
      case 'light_intensity':
        return `Threshold: ${thresholds.lightMin} klx`
      case 'water_level':
        return `Alert: distance > ${thresholds.waterTarget}cm`
      default:
        return ''
    }
  }

  // 导出 CSV 功能
  const handleExportCSV = () => {
    const sensor = sensorData.find((s) => s.id === activeChart)
    if (!sensor || historyData.length === 0) return

    // CSV 表头
    const headers = ['Timestamp', 'Value', 'Unit']

    // CSV 数据行
    const rows = historyData.map((d) => {
      const date = new Date(d.timestamp)
      const timestamp = date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
      return [timestamp, d.value.toFixed(2), sensor.unit]
    })

    // 组合 CSV 内容
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')

    // 创建 Blob 并下载
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    link.href = url
    link.download = `SmartGreenhouse_历史数据_${sensor.name}_${dateStr}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="h-screen bg-[#F8FAF9] font-sans overflow-hidden flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[#E5EFE8] h-[60px] flex items-center shrink-0">
        <div className="w-full max-w-[1920px] mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="p-2 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <Leaf size={20} className="text-emerald-500" />
              Smart Greenhouse
            </h1>
          </div>

          <div className="flex items-center gap-6">
            {/* Mode Toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
              <button
                onClick={() => setAutoMode(false)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                  !autoMode ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'
                }`}
              >
                Manual
              </button>
              <button
                onClick={() => setAutoMode(true)}
                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${
                  autoMode ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500'
                }`}
              >
                Auto
              </button>
            </div>

            {/* Live Indicator */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="w-full max-w-[1920px] mx-auto px-4 py-3 flex-1 min-h-0">
        <div className="grid grid-cols-12 gap-3 h-full">
          {/* Left Sidebar - Crop Selection */}
          <div className="col-span-2 flex flex-col min-h-0">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E5EFE8] flex-1 flex flex-col min-h-0">
              <h2 className="text-xs font-semibold text-gray-800 mb-3 flex items-center gap-2 uppercase tracking-wider shrink-0">
                <Leaf size={14} />
                Select Crop
              </h2>
              <div className="space-y-2 flex-1 min-h-0 overflow-y-auto">
                {crops.map((crop) => (
                  <button
                    key={crop.id}
                    onClick={() => handleSelectCrop(crop)}
                    className={`w-full p-3 rounded-xl text-left transition-all ${
                      selectedCrop.id === crop.id
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                        : 'hover:bg-gray-50 text-gray-600 border border-transparent'
                    }`}
                  >
                    <div className="font-medium text-sm">{crop.name}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{crop.description}</div>
                  </button>
                ))}
              </div>

              {/* Custom Crop Input */}
              <div className="mt-auto pt-3 border-t border-gray-100">
                <label className="text-xs text-gray-500 mb-2 block">Add your crop</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customCropName}
                    onChange={(e) => setCustomCropName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCrop()}
                    placeholder="e.g. Basil, Mint..."
                    className="flex-1 px-3 py-2 rounded-lg bg-gray-50 border-0 border-b-2 border-gray-200 focus:border-emerald-400 focus:outline-none text-sm text-gray-700 placeholder:text-gray-400"
                  />
                  <button
                    onClick={handleAddCrop}
                    className="p-2.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm"
                    title="Add crop"
                  >
                    <Plus size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Center - Sensors & Chart */}
          <div className="col-span-8 flex flex-col gap-3 min-h-0">
            {/* Sensor Cards */}
            <div className="grid grid-cols-5 gap-2">
              {sensorData.map((sensor) => {
                const status = getAlertStatus(sensor.id)
                return (
                  <div
                    key={sensor.id}
                    className={`bg-white rounded-xl p-2.5 shadow-sm border transition-all ${
                      status === 'danger' ? 'border-red-200 bg-[#FFF5F5]' : 'border-[#E5EFE8]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-1 rounded-md bg-gray-50 text-gray-400">
                        {SENSOR_ICONS[sensor.icon]}
                      </div>
                      {status === 'danger' && (
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                      )}
                      {status === 'warning' && (
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                      )}
                    </div>
                    <div className="text-xs font-semibold text-gray-500 tracking-wider uppercase mb-1 truncate">
                      {sensor.name}
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-3xl font-bold ${status === 'danger' ? 'text-red-600' : 'text-emerald-600'}`}>
                        {sensor.value.toFixed(1)}
                      </span>
                      <span className="text-xs text-gray-400">{sensor.unit}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {status === 'normal' ? 'Normal' : status === 'warning' ? 'Warning' : 'Alert'}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Chart Section */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E5EFE8] flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-semibold text-gray-800 flex items-center gap-2 uppercase tracking-wider">
                  <TrendingUp size={14} />
                  Trends (24h)
                </h2>
                <div className="flex items-center gap-2">
                  <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
                    {sensorData.map((sensor) => (
                      <button
                        key={sensor.id}
                        onClick={() => setActiveChart(sensor.id)}
                        className={`px-2 py-0.5 rounded-md text-xs font-medium transition-all ${
                          activeChart === sensor.id
                            ? 'bg-emerald-500 text-white shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {sensor.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleExportCSV}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50 transition-all"
                    title="Export CSV"
                  >
                    <Download size={14} />
                  </button>
                </div>
              </div>

              {/* Recharts Chart */}
              <div className="h-[300px] w-full shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historyData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" vertical={false} />
                    <XAxis
                      dataKey="timestamp"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      tickCount={6}
                      tickFormatter={(value) => {
                        const date = new Date(value)
                        return `${date.getHours()}:00`
                      }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: '#9ca3af' }}
                      domain={[0, getYAxisMax(activeChart)]}
                      tickCount={getYAxisCount(activeChart)}
                      tickFormatter={(value) => `${value}${getYAxisUnit(activeChart)}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                      }}
                      labelStyle={{ color: '#6b7280', fontSize: 12 }}
                      itemStyle={{ color: '#10b981', fontSize: 14, fontWeight: 600 }}
                      labelFormatter={(value) => new Date(value as string | number).toLocaleString()}
                      formatter={(value: any) => [
                        `${Number(value ?? 0).toFixed(1)}${getYAxisUnit(activeChart)}`,
                        sensorData.find((s) => s.id === activeChart)?.name ?? activeChart,
                      ]}
                    />
                    {getThresholdLine(activeChart) && (
                      <ReferenceLine
                        y={getThresholdValue(activeChart)}
                        stroke="#ef4444"
                        strokeDasharray="3 3"
                        label={{
                          value: getThresholdLabel(activeChart),
                          position: 'insideTopRight',
                          fill: '#ef4444',
                          fontSize: 11,
                        }}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="#10b981"
                      strokeWidth={2.5}
                      fill="url(#colorValue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Chart Legend */}
              <div className="flex items-center justify-between text-xs text-gray-400 mt-2">
                <span>24 hours ago</span>
                <span className="font-medium text-gray-600">
                  {sensorData.find((s) => s.id === activeChart)?.name}
                </span>
                <span>Now</span>
              </div>

              {/* Quick Stats */}
              <div className="flex items-center justify-center gap-2 mt-1 pt-1 border-t border-gray-100">
                <div className="bg-gray-50 rounded-lg px-3 py-1 text-center min-w-[70px]">
                  <div className="text-sm font-bold text-emerald-600">
                    {actuators.filter((a) => a.status).length}
                  </div>
                  <div className="text-[10px] text-gray-400">Active Actuators</div>
                </div>
                <div className="bg-gray-50 rounded-lg px-3 py-1 text-center min-w-[70px]">
                  <div className="text-sm font-bold text-emerald-600">
                    {sensorData.filter((s) => getAlertStatus(s.id) === 'normal').length}/{sensorData.length}
                  </div>
                  <div className="text-[10px] text-gray-400">Sensors Normal</div>
                </div>
                <div className="bg-gray-50 rounded-lg px-3 py-1 text-center min-w-[70px]">
                  <div className="text-sm font-bold text-emerald-600 truncate">{selectedCrop.name}</div>
                  <div className="text-[10px] text-gray-400">Current Crop</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar - Actuators & Thresholds */}
          <div className="col-span-2 flex flex-col gap-3 min-h-0">
            {/* Actuators */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E5EFE8]">
              <h2 className="text-xs font-semibold text-gray-800 mb-3 flex items-center gap-2 uppercase tracking-wider">
                <Power size={14} />
                Actuators
              </h2>
              <div className="space-y-1.5">
                {actuators.map((actuator) => (
                  <div
                    key={actuator.id}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-lg transition-colors ${actuator.status ? 'bg-green-50 text-green-500' : 'bg-gray-50 text-gray-400'}`}>
                        {SENSOR_ICONS[actuator.icon]}
                      </div>
                      <span className="text-sm font-medium text-gray-700">{actuator.name}</span>
                    </div>
                    <button
                      onClick={() => toggleActuator(actuator.id)}
                      className={`relative w-10 h-5 rounded-full transition-all ${
                        actuator.status ? 'bg-green-500' : 'bg-gray-300'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                          actuator.status ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Threshold Settings */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-[#E5EFE8] flex-1 flex flex-col min-h-0">
              <h2 className="text-xs font-semibold text-gray-800 mb-3 flex items-center gap-2 uppercase tracking-wider shrink-0">
                <Settings size={14} />
                Thresholds
              </h2>
              <div className="space-y-1 flex-1 min-h-0 overflow-y-auto">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-500">Air Temp Max</label>
                    <span className="text-xs font-medium text-emerald-600">{thresholds.airTempMax}°C</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={thresholds.airTempMax}
                    onChange={(e) => updateThreshold('airTempMax', Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-500">Air Humidity Min</label>
                    <span className="text-xs font-medium text-emerald-600">{thresholds.airHumidityMin}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={thresholds.airHumidityMin}
                    onChange={(e) => updateThreshold('airHumidityMin', Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-500">Soil Moisture Min</label>
                    <span className="text-xs font-medium text-emerald-600">{thresholds.soilMoistureMin}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={thresholds.soilMoistureMin}
                    onChange={(e) => updateThreshold('soilMoistureMin', Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-500">Light Min</label>
                    <span className="text-xs font-medium text-emerald-600">{thresholds.lightMin} klx</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    step="0.5"
                    value={thresholds.lightMin}
                    onChange={(e) => updateThreshold('lightMin', Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-500">Water Level Threshold</label>
                    <span className="text-xs font-medium text-emerald-600">{thresholds.waterTarget} cm</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    step="1"
                    value={thresholds.waterTarget}
                    onChange={(e) => updateThreshold('waterTarget', Number(e.target.value))}
                    className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveThresholds}
                className="w-full mt-auto py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
              >
                <Check size={14} />
                Save Thresholds
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Log Panel */}
      <div className="w-full max-w-[1920px] mx-auto px-4 h-[100px] shrink-0">
        <AlertLogPanel ref={logPanelRef} />
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-6 right-6 bg-emerald-500 text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 animate-fade-in">
          <Check size={16} />
          <span className="text-sm font-medium">Thresholds saved successfully</span>
        </div>
      )}
    </div>
  )
}
