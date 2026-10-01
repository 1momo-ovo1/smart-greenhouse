/**
 * Mock API Service
 * 纯前端 Mock 数据模式 - 无任何网络请求
 */

// 数据流 ID 定义
export const DATA_STREAMS = {
  AIR_TEMP: 'air_temperature',
  AIR_HUMIDITY: 'air_humidity',
  SOIL_MOISTURE: 'soil_moisture',
  LIGHT_INTENSITY: 'light_intensity',
  CO2_CONCENTRATION: 'co2_concentration',
  HEATER: 'heater',
  HUMIDIFIER: 'humidifier',
  IRRIGATION: 'irrigation',
  LIGHT: 'light',
  FAN: 'fan',
} as const

export interface SensorData {
  id: string
  name: string
  value: number | null
  unit: string
  timestamp: number
  icon: string
}

export interface ActuatorState {
  id: string
  name: string
  status: boolean
  icon: string
  value?: number
}

export interface ThresholdConfig {
  airTempMax: number
  airHumidityMin: number
  soilMoistureMin: number
  lightMin: number
}

export interface VegetableProfile {
  id: string
  name: string
  thresholds: ThresholdConfig
  description: string
}

// 预设蔬菜配置
export const VEGETABLE_PROFILES: VegetableProfile[] = [
  {
    id: 'lettuce',
    name: 'Lettuce',
    thresholds: { airTempMax: 25, airHumidityMin: 60, soilMoistureMin: 50, lightMin: 8000 },
    description: 'Cool-season crop, prefers high humidity',
  },
  {
    id: 'tomato',
    name: 'Tomato',
    thresholds: { airTempMax: 30, airHumidityMin: 50, soilMoistureMin: 40, lightMin: 12000 },
    description: 'Warm-season crop, needs plenty of light',
  },
  {
    id: 'cucumber',
    name: 'Cucumber',
    thresholds: { airTempMax: 28, airHumidityMin: 70, soilMoistureMin: 55, lightMin: 10000 },
    description: 'Loves warm and humid environment',
  },
  {
    id: 'pepper',
    name: 'Pepper',
    thresholds: { airTempMax: 32, airHumidityMin: 45, soilMoistureMin: 35, lightMin: 15000 },
    description: 'Heat-tolerant, needs strong light',
  },
  {
    id: 'strawberry',
    name: 'Strawberry',
    thresholds: { airTempMax: 26, airHumidityMin: 55, soilMoistureMin: 45, lightMin: 9000 },
    description: 'Prefers cool days and warm nights',
  },
]
