/**
 * Cloudflare Pages Function: GET /api/sensors
 * 代理 OneNET API 请求，获取传感器最新数据
 *
 * OneNET 物模型标识符：
 * - temp: 空气温度（只读）
 * - hum: 空气湿度（只读）
 * - light: 光照强度（只读）
 * - soil_humi: 土壤湿度（只读）
 * - water: 水位（只读，单位 cm，距离）
 * - temp_target: 温度设定值（读写）
 * - hum_target: 湿度设定值（读写）
 * - soil_target: 土壤湿度设定值（读写）
 * - light_target: 光照设定值（读写）
 */

const ONENET_BASE_URL = 'https://api.heclouds.com'

// OneNET 物模型标识符到前端字段名的映射
const STREAM_MAPPING = {
  temp: 'air_temp',
  hum: 'air_humidity',
  light: 'light_intensity',
  soil_humi: 'soil_humidity',
  water: 'water_level',
  temp_target: 'temp_target',
  hum_target: 'hum_target',
  soil_target: 'soil_target',
  light_target: 'light_target',
}

// 传感器元数据
const SENSOR_METADATA = {
  air_temp: { name: 'Air Temperature', unit: '°C', icon: 'thermometer' },
  air_humidity: { name: 'Air Humidity', unit: '%', icon: 'droplets' },
  light_intensity: { name: 'Light Intensity', unit: 'klux', icon: 'sun' },
  soil_humidity: { name: 'Soil Moisture', unit: '%', icon: 'sprout' },
  water_level: { name: 'Water Level', unit: 'cm', icon: 'waves' },
  temp_target: { name: 'Temp Target', unit: '°C', icon: 'thermometer' },
  hum_target: { name: 'Humidity Target', unit: '%', icon: 'droplets' },
  soil_target: { name: 'Soil Target', unit: '%', icon: 'sprout' },
  light_target: { name: 'Light Target', unit: 'klux', icon: 'sun' },
}

export async function onRequestGet(context) {
  const { request, env } = context
  const url = new URL(request.url)

  const apiKey = env.ONENET_API_KEY
  const deviceId = env.ONENET_DEVICE_ID

  if (!apiKey || !deviceId) {
    return new Response(
      JSON.stringify({ error: 'Missing ONENET_API_KEY or ONENET_DEVICE_ID environment variables' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // 查询所有数据流
  const datastreamIds = url.searchParams.get('datastream_id') || 'temp,hum,light,soil_humi,water,temp_target,hum_target,soil_target,light_target'

  const oneNetUrl = `${ONENET_BASE_URL}/devices/${deviceId}/datapoints?datastream_id=${datastreamIds}`

  try {
    const response = await fetch(oneNetUrl, {
      method: 'GET',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      return new Response(
        JSON.stringify({ error: `OneNET API error: ${response.status}`, details: errorText }),
        {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const data = await response.json()

    // 转换 OneNET 数据格式为前端需要的格式
    const sensors = []
    if (data.data && data.data.datastreams) {
      for (const stream of data.data.datastreams) {
        if (stream.datapoints && stream.datapoints.length > 0) {
          const latest = stream.datapoints[0]
          const frontendId = STREAM_MAPPING[stream.id] || stream.id
          const metadata = SENSOR_METADATA[frontendId] || { name: stream.id, unit: '', icon: 'activity' }

          sensors.push({
            id: frontendId,
            originalId: stream.id,
            name: metadata.name,
            value: parseFloat(latest.value),
            unit: metadata.unit,
            timestamp: latest.at,
            icon: metadata.icon,
          })
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: sensors,
        meta: {
          deviceId,
          fetchedAt: new Date().toISOString(),
          datastreams: sensors.length,
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Failed to fetch from OneNET', details: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}

// 处理 OPTIONS 预检请求
export async function onRequest(context) {
  const { request } = context

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  return onRequestGet(context)
}
