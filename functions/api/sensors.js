/**
 * Cloudflare Pages Function: GET /api/sensors
 * OneNET Studio（新版）API 代理：查询设备最新数据点
 *
 * 平台：OneNET Studio（open.iot.10086.cn）
 * 接口：GET https://iot-api.heclouds.com/thingmodel/query-device-property
 * 鉴权：请求头 authorization: {accessKey}（新版，非旧版 api-key）
 *
 * 环境变量（本地开发写在 .dev.vars）：
 * - ONENET_PRODUCT_ID   产品 ID
 * - ONENET_DEVICE_NAME  设备名称
 * - ONENET_ACCESS_KEY   产品 AccessKey
 */

const ONENET_API_BASE = 'https://iot-api.heclouds.com'

// OneNET 物模型 identifier -> 前端字段名
const IDENTIFIER_MAPPING = {
  temp: 'air_temp',
  hum: 'air_humidity',
  light: 'light_intensity',
}

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
}

// 统一 JSON 响应（始终带上 CORS 头）
function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: JSON_HEADERS,
  })
}

/**
 * 兼容新版 API 的 data 结构：
 * 1) 数组（实际返回）：[{ identifier: 'temp', value: '25.2', time: 1790878355191, data_type: 'float' }, ...]
 *    注意 value 为字符串，且部分属性（如 fan_switch）没有 value 字段
 * 2) 对象：{ temp: 25.4, hum: 60.2 } 或 { temp: { value: 25.4, time: '...' } }
 */
function normalizeDatapoints(data) {
  const items = []

  if (Array.isArray(data)) {
    for (const item of data) {
      if (item && typeof item.identifier === 'string') {
        items.push(item)
      }
    }
    return items
  }

  if (data && typeof data === 'object') {
    for (const [identifier, entry] of Object.entries(data)) {
      if (entry && typeof entry === 'object' && !Array.isArray(entry) && 'value' in entry) {
        items.push({ identifier, value: entry.value, time: entry.time })
      } else {
        items.push({ identifier, value: entry })
      }
    }
  }

  return items
}

// 按映射关系组装前端需要的数据（不做单位换算）
function buildSensorData(items) {
  const result = {}

  for (const item of items) {
    const field = IDENTIFIER_MAPPING[item.identifier]
    if (!field) continue

    // 跳过没有 value 字段的属性（设备从未上报）
    if (item.value === undefined || item.value === null || item.value === '') continue

    // value 是字符串，统一转成数字
    const raw = Number(item.value)
    if (!Number.isFinite(raw)) continue

    result[field] = raw
  }

  return result
}

export async function onRequestGet(context) {
  const { env } = context

  try {
    const productId = env.ONENET_PRODUCT_ID
    const deviceName = env.ONENET_DEVICE_NAME
    const accessKey = env.ONENET_ACCESS_KEY

    if (!productId || !deviceName || !accessKey) {
      return jsonResponse(500, { error: 'Missing OneNET environment variables' })
    }

    const url =
      `${ONENET_API_BASE}/thingmodel/query-device-property` +
      `?product_id=${encodeURIComponent(productId)}` +
      `&device_name=${encodeURIComponent(deviceName)}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        authorization: accessKey,
        'Content-Type': 'application/json',
      },
    })

    // 响应非 200：返回 502 并透传错误信息
    if (!response.ok) {
      const details = await response.text()
      return jsonResponse(502, {
        error: `OneNET API error: ${response.status}`,
        details,
      })
    }

    const raw = await response.text()

    let body
    try {
      body = JSON.parse(raw)
    } catch {
      return jsonResponse(502, {
        error: 'Invalid JSON returned by OneNET',
        details: raw,
      })
    }

    // 业务 code 不为 0：返回 502 并透传错误信息
    if (body?.code !== 0) {
      return jsonResponse(502, {
        error: `OneNET API error code: ${body?.code}`,
        details: body?.msg ?? body,
      })
    }

    const data = buildSensorData(normalizeDatapoints(body.data))

    return jsonResponse(200, {
      success: true,
      data,
    })
  } catch (error) {
    return jsonResponse(500, {
      error: 'Failed to fetch from OneNET',
      details: error?.message ?? String(error),
    })
  }
}
