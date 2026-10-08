/**
 * Cloudflare Pages Function: POST /api/control
 * OneNET Studio（新版）API 代理：下发设备属性（物模型）
 *
 * 平台：OneNET Studio（open.iot.10086.cn）
 * 接口：POST https://iot-api.heclouds.com/thingmodel/set-device-property
 * 鉴权：请求头 authorization: {accessKey}（新版，非旧版 api-key）
 *
 * 请求体：{ "datastream": "fan_switch", "value": 1 }
 *
 * 环境变量（本地开发写在 .dev.vars）：
 * - ONENET_PRODUCT_ID   产品 ID
 * - ONENET_DEVICE_NAME  设备名称
 * - ONENET_ACCESS_KEY   产品 AccessKey
 */

const ONENET_API_BASE = 'https://iot-api.heclouds.com'

// 可写属性白名单（必须与 functions/api/sensors.js 的回读列表保持一致）
const BOOL_IDENTIFIERS = new Set(['light_switch', 'fan', 'humidifier', 'irrigation', 'buzzer'])
const RANGE_IDENTIFIERS = {
  work_mode: [0, 1], // 0 手动 / 1 自动
  temp_max: [-40, 85], // 温度上限 °C
  hum_min: [0, 100], // 湿度下限 %
  soil_min: [0, 100], // 土壤湿度下限 %
  light_min: [0, 100], // 光照下限 %
  water_max: [0, 50], // 水位距离上限 cm（距离越大水位越低）
}
const WRITABLE_IDENTIFIERS = new Set([...BOOL_IDENTIFIERS, ...Object.keys(RANGE_IDENTIFIERS)])

// enum 属性：平台对取值格式（数字 / 字符串）在不同版本上不一致，
// 首次下发失败时会把数字换成字符串自动重试一次
const ENUM_IDENTIFIERS = ['work_mode']

// 校验并归一化下发值；非法返回 null
function normalizeValue(identifier, value) {
  if (BOOL_IDENTIFIERS.has(identifier)) {
    if (typeof value === 'boolean') return value
    if (value === 1 || value === '1' || value === 'true') return true
    if (value === 0 || value === '0' || value === 'false') return false
    return null
  }
  const raw = typeof value === 'string' ? Number(value) : value
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null
  const [min, max] = RANGE_IDENTIFIERS[identifier]
  if (raw < min || raw > max) return null
  return raw
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
 * 生成 OneNET 安全鉴权 Token（HMAC-SHA1）
 * authorization = version=2022-05-01&res=products/{productId}&et={过期时间戳}&method=sha1&sign={签名}
 * StringForSignature = et + "\n" + method + "\n" + res + "\n" + version
 */
async function generateToken(productId, accessKey) {
  const version = '2022-05-01'
  const method = 'sha1'
  const res = `products/${productId}`
  // 1 小时有效期
  const et = Math.floor(Date.now() / 1000) + 3600

  const stringForSignature = `${et}\n${method}\n${res}\n${version}`

  // accessKey 是 base64 编码的密钥，先解码成二进制字节
  const binaryKey = atob(accessKey)
  const keyBytes = new Uint8Array(binaryKey.length)
  for (let i = 0; i < binaryKey.length; i++) {
    keyBytes[i] = binaryKey.charCodeAt(i)
  }

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    new TextEncoder().encode(stringForSignature)
  )

  // 签名结果 base64 编码
  const sign = btoa(String.fromCharCode(...new Uint8Array(signature)))

  return (
    `version=${version}` +
    `&res=${encodeURIComponent(res)}` +
    `&et=${et}` +
    `&method=${method}` +
    `&sign=${encodeURIComponent(sign)}`
  )
}

export async function onRequestPost(context) {
  const { request, env } = context

  try {
    const productId = env.ONENET_PRODUCT_ID
    const deviceName = env.ONENET_DEVICE_NAME
    const accessKey = env.ONENET_ACCESS_KEY

    if (!productId || !deviceName || !accessKey) {
      return jsonResponse(500, { success: false, error: 'Missing OneNET environment variables' })
    }

    // 解析请求体
    let payload
    try {
      payload = await request.json()
    } catch {
      return jsonResponse(400, { success: false, error: 'Invalid JSON body' })
    }

    // 支持两种请求体：
    //   { "datastream": "fan", "value": true }            单个属性
    //   { "params": { "temp_max": 25, "hum_min": 60 } }   批量属性
    let incoming = payload?.params
    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      const datastream = payload?.datastream
      if (!datastream || typeof datastream !== 'string') {
        return jsonResponse(400, {
          success: false,
          error: 'Missing "params" or "datastream" in request body',
        })
      }
      incoming = { [datastream]: payload?.value }
    }

    // 白名单 + 取值校验，防止任意属性被公网调用改写
    const params = {}
    for (const [identifier, value] of Object.entries(incoming)) {
      if (!WRITABLE_IDENTIFIERS.has(identifier)) {
        return jsonResponse(400, {
          success: false,
          error: `Property "${identifier}" is not writable`,
        })
      }
      const normalized = normalizeValue(identifier, value)
      if (normalized === null) {
        const expect = BOOL_IDENTIFIERS.has(identifier)
          ? 'true / false'
          : `${RANGE_IDENTIFIERS[identifier][0]} ~ ${RANGE_IDENTIFIERS[identifier][1]}`
        return jsonResponse(400, {
          success: false,
          error: `Invalid value for "${identifier}" (expect ${expect})`,
        })
      }
      params[identifier] = normalized
    }

    const authorization = await generateToken(productId, accessKey)

    // enum 属性可能要求数字或字符串两种格式之一：首次失败时换一种再试一次
    const attempts = [params]
    if (Object.keys(params).some((id) => ENUM_IDENTIFIERS.includes(id))) {
      attempts.push(
        Object.fromEntries(
          Object.entries(params).map(([id, v]) => [
            id,
            ENUM_IDENTIFIERS.includes(id) && typeof v === 'number' ? String(v) : v,
          ])
        )
      )
    }

    let response = null
    let raw = ''
    let body = null
    for (let i = 0; i < attempts.length; i++) {
      response = await fetch(`${ONENET_API_BASE}/thingmodel/set-device-property`, {
        method: 'POST',
        headers: {
          authorization,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: productId,
          device_name: deviceName,
          params: attempts[i],
        }),
      })

      raw = await response.text()
      try {
        body = JSON.parse(raw)
      } catch {
        body = null
      }

      // 成功，或已经是最后一次尝试：退出
      if ((response.ok && body?.code === 0) || i === attempts.length - 1) break
    }

    // 响应非 200：返回 502 并透传错误信息
    if (!response.ok) {
      return jsonResponse(502, {
        success: false,
        error: `OneNET API error: ${response.status}`,
        details: body ?? raw,
      })
    }

    if (!body) {
      return jsonResponse(502, {
        success: false,
        error: 'Invalid JSON returned by OneNET',
        details: raw,
      })
    }

    // 业务 code 不为 0：返回 502 并透传错误信息
    if (body?.code !== 0) {
      return jsonResponse(502, {
        success: false,
        error: `OneNET API error code: ${body?.code}`,
        details: body?.msg ?? body,
      })
    }

    return jsonResponse(200, {
      success: true,
      data: body.data ?? null,
    })
  } catch (error) {
    return jsonResponse(500, {
      success: false,
      error: 'Failed to control device',
      details: error?.message ?? String(error),
    })
  }
}
