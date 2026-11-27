// 豆瓣个性化推荐（CookieCloud 自动提供登录态）
WidgetMetadata = {
  id: "zen.douban.recommend",
  title: "豆瓣个性化推荐",
  description: "根据豆瓣个人口味生成推荐列表；登录态由 CookieCloud 自动获取，无需手工粘贴 Cookie",
  author: "Zen",
  version: "0.1.1",
  site: "https://github.com/zenmic7/zenmic.github.io/blob/ForwardWidget/douban.js",
  requiredVersion: "0.0.1",
  modules: [
    {
      title: "豆瓣个性化推荐",
      requiresWebView: false,
      functionName: "loadSuggestionItems",
      cacheDuration: 43200,
      params: [
        {
          name: "type",
          title: "类型",
          type: "enumeration",
          enumOptions: [
            { title: "电影", value: "movie" },
            { title: "电视", value: "tv" },
          ],
        },
        { name: "page", title: "页码", type: "page" },
        {
          name: "cc_host",
          title: "CookieCloud 地址",
          type: "input",
          description: "例如 https://cc.zenmic.top/cookiecloud；只填域名会自动补 /cookiecloud",
        },
        { name: "cc_uuid", title: "CookieCloud UUID", type: "input" },
        { name: "cc_password", title: "CookieCloud 密码", type: "input" },
        {
          name: "cookie",
          title: "手工 Cookie（兜底，可留空）",
          type: "input",
          description: "留空则用上面的 CookieCloud；CookieCloud 取不到时可用它兜底",
        },
      ],
    },
  ],
};

var DB_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36";

// ==================== CookieCloud（legacy AES-CBC） ====================

var _CC_S = [
  0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
  0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
  0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
  0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2, 0xeb, 0x27, 0xb2, 0x75,
  0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0, 0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84,
  0x53, 0xd1, 0x00, 0xed, 0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
  0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f, 0x50, 0x3c, 0x9f, 0xa8,
  0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5, 0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2,
  0xcd, 0x0c, 0x13, 0xec, 0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
  0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14, 0xde, 0x5e, 0x0b, 0xdb,
  0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c, 0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79,
  0xe7, 0xc8, 0x37, 0x6d, 0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
  0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f, 0x4b, 0xbd, 0x8b, 0x8a,
  0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e, 0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e,
  0xe1, 0xf8, 0x98, 0x11, 0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
  0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f, 0xb0, 0x54, 0xbb, 0x16,
];
var _CC_SI = new Array(256);
for (var _i = 0; _i < 256; _i++) _CC_SI[_CC_S[_i]] = _i;

function _ccXtime(b) {
  return ((b << 1) ^ (b & 0x80 ? 0x1b : 0)) & 0xff;
}
function _ccMul(a, b) {
  var r = 0;
  while (b) {
    if (b & 1) r ^= a;
    a = _ccXtime(a);
    b >>= 1;
  }
  return r & 0xff;
}
function _ccExpand(key) {
  var Nk = 8, Nr = 14, w = new Array(4 * (Nr + 1)), i;
  for (i = 0; i < Nk; i++)
    w[i] = ((key[4 * i] << 24) | (key[4 * i + 1] << 16) | (key[4 * i + 2] << 8) | key[4 * i + 3]) >>> 0;
  var rcon = 1;
  for (i = Nk; i < w.length; i++) {
    var t = w[i - 1];
    if (i % Nk === 0) {
      t = ((t << 8) | (t >>> 24)) >>> 0;
      t =
        ((_CC_S[(t >>> 24) & 0xff] << 24) |
          (_CC_S[(t >>> 16) & 0xff] << 16) |
          (_CC_S[(t >>> 8) & 0xff] << 8) |
          _CC_S[t & 0xff]) >>>
        0;
      t = (t ^ (rcon << 24)) >>> 0;
      rcon = _ccXtime(rcon);
    } else if (i % Nk === 4) {
      t =
        ((_CC_S[(t >>> 24) & 0xff] << 24) |
          (_CC_S[(t >>> 16) & 0xff] << 16) |
          (_CC_S[(t >>> 8) & 0xff] << 8) |
          _CC_S[t & 0xff]) >>>
        0;
    }
    w[i] = (w[i - Nk] ^ t) >>> 0;
  }
  return w;
}
function _ccAddRoundKey(s, w, round) {
  for (var c = 0; c < 4; c++) {
    var word = w[round * 4 + c];
    s[4 * c] ^= (word >>> 24) & 0xff;
    s[4 * c + 1] ^= (word >>> 16) & 0xff;
    s[4 * c + 2] ^= (word >>> 8) & 0xff;
    s[4 * c + 3] ^= word & 0xff;
  }
}
function _ccInvShiftRows(s) {
  var t;
  t = s[13]; s[13] = s[9]; s[9] = s[5]; s[5] = s[1]; s[1] = t;
  t = s[2]; s[2] = s[10]; s[10] = t;
  t = s[6]; s[6] = s[14]; s[14] = t;
  t = s[3]; s[3] = s[7]; s[7] = s[11]; s[11] = s[15]; s[15] = t;
}
function _ccInvSubBytes(s) {
  for (var i = 0; i < 16; i++) s[i] = _CC_SI[s[i]];
}
function _ccInvMixColumns(s) {
  for (var c = 0; c < 4; c++) {
    var a0 = s[4 * c], a1 = s[4 * c + 1], a2 = s[4 * c + 2], a3 = s[4 * c + 3];
    s[4 * c] = _ccMul(a0, 14) ^ _ccMul(a1, 11) ^ _ccMul(a2, 13) ^ _ccMul(a3, 9);
    s[4 * c + 1] = _ccMul(a0, 9) ^ _ccMul(a1, 14) ^ _ccMul(a2, 11) ^ _ccMul(a3, 13);
    s[4 * c + 2] = _ccMul(a0, 13) ^ _ccMul(a1, 9) ^ _ccMul(a2, 14) ^ _ccMul(a3, 11);
    s[4 * c + 3] = _ccMul(a0, 11) ^ _ccMul(a1, 13) ^ _ccMul(a2, 9) ^ _ccMul(a3, 14);
  }
}
function _ccDecryptCbc(key, iv, data) {
  var w = _ccExpand(key);
  var blocks = Math.floor(data.length / 16);
  var out = new Uint8Array(blocks * 16);
  var prev = iv.slice(0);
  var s = new Array(16);
  for (var b = 0; b < blocks; b++) {
    var off = b * 16, i;
    for (i = 0; i < 16; i++) s[i] = data[off + i];
    _ccAddRoundKey(s, w, 14);
    for (var r = 13; r >= 1; r--) {
      _ccInvShiftRows(s);
      _ccInvSubBytes(s);
      _ccAddRoundKey(s, w, r);
      _ccInvMixColumns(s);
    }
    _ccInvShiftRows(s);
    _ccInvSubBytes(s);
    _ccAddRoundKey(s, w, 0);
    for (i = 0; i < 16; i++) {
      out[off + i] = s[i] ^ prev[i];
      prev[i] = data[off + i];
    }
  }
  var pad = out[out.length - 1];
  if (pad > 0 && pad <= 16) out = out.subarray(0, out.length - pad);
  return out;
}

// ---- MD5（对字节数组求 16 字节摘要） ----
function _ccMd5(bytes) {
  var rl = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
            5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
            4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
            6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  var K = new Array(64);
  for (var i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;

  var msgLen = bytes.length;
  var withPad = (((msgLen + 8) >> 6) + 1) * 64;
  var msg = new Uint8Array(withPad);
  msg.set(bytes);
  msg[msgLen] = 0x80;
  var bitLenLo = (msgLen * 8) >>> 0;
  var bitLenHi = Math.floor((msgLen * 8) / 4294967296) >>> 0;
  msg[withPad - 8] = bitLenLo & 0xff;
  msg[withPad - 7] = (bitLenLo >>> 8) & 0xff;
  msg[withPad - 6] = (bitLenLo >>> 16) & 0xff;
  msg[withPad - 5] = (bitLenLo >>> 24) & 0xff;
  msg[withPad - 4] = bitLenHi & 0xff;

  var a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  var M = new Array(16);
  for (var off = 0; off < withPad; off += 64) {
    for (i = 0; i < 16; i++)
      M[i] = msg[off + i * 4] | (msg[off + i * 4 + 1] << 8) | (msg[off + i * 4 + 2] << 16) | (msg[off + i * 4 + 3] << 24);
    var A = a0, B = b0, C = c0, D = d0;
    for (i = 0; i < 64; i++) {
      var F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + K[i] + M[g]) | 0;
      A = D; D = C; C = B;
      B = (B + ((F << rl[i]) | (F >>> (32 - rl[i])))) | 0;
    }
    a0 = (a0 + A) | 0; b0 = (b0 + B) | 0; c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
  }
  var out = new Uint8Array(16);
  [a0, b0, c0, d0].forEach(function (v, idx) {
    out[idx * 4] = v & 0xff;
    out[idx * 4 + 1] = (v >>> 8) & 0xff;
    out[idx * 4 + 2] = (v >>> 16) & 0xff;
    out[idx * 4 + 3] = (v >>> 24) & 0xff;
  });
  return out;
}
function _ccHex(bytes) {
  var s = "";
  for (var i = 0; i < bytes.length; i++) s += (bytes[i] < 16 ? "0" : "") + bytes[i].toString(16);
  return s;
}
function _ccUtf8Bytes(str) {
  var out = [];
  for (var i = 0; i < str.length; i++) {
    var c = str.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c >= 0xd800 && c <= 0xdbff) {
      var c2 = str.charCodeAt(++i);
      var cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
    } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return new Uint8Array(out);
}
function _ccBytesUtf8(bytes) {
  var out = "", i = 0;
  while (i < bytes.length) {
    var b = bytes[i++];
    if (b < 0x80) out += String.fromCharCode(b);
    else if (b < 0xe0) out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i++] & 0x3f));
    else if (b < 0xf0)
      out += String.fromCharCode(((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f));
    else {
      var cp = (((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f)) - 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    }
  }
  return out;
}
function _ccB64(str) {
  var table = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var clean = String(str).replace(/[^A-Za-z0-9+/=]/g, "");
  var out = [], buf = 0, bits = 0;
  for (var i = 0; i < clean.length; i++) {
    var ch = clean.charAt(i);
    if (ch === "=") break;
    var v = table.indexOf(ch);
    if (v < 0) continue;
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 0xff);
    }
  }
  return new Uint8Array(out);
}

// CookieCloud legacy：key = md5(uuid-password).hex[0:16] 作为口令，EVP_BytesToKey(MD5) 派生 48 字节
function _ccEvp(passBytes, salt) {
  var out = [], prev = [];
  while (out.length < 48) {
    var input = new Uint8Array(prev.length + passBytes.length + salt.length);
    input.set(prev, 0);
    input.set(passBytes, prev.length);
    input.set(salt, prev.length + passBytes.length);
    prev = Array.prototype.slice.call(_ccMd5(input));
    out = out.concat(prev);
  }
  return new Uint8Array(out.slice(0, 48));
}
function ccDecryptLegacy(encrypted, uuid, password) {
  var pass = _ccHex(_ccMd5(_ccUtf8Bytes(uuid + "-" + password))).slice(0, 16);
  var blob = _ccB64(encrypted);
  if (blob.length < 32) throw new Error("CookieCloud 密文过短");
  var isSalted = blob[0] === 0x53 && blob[1] === 0x61 && blob[2] === 0x6c && blob[3] === 0x74;
  var salt, ct;
  if (isSalted) {
    salt = blob.subarray(8, 16);
    ct = blob.subarray(16);
  } else {
    throw new Error("CookieCloud 密文格式非 legacy（无 Salted__ 头）");
  }
  var kv = _ccEvp(_ccUtf8Bytes(pass), salt);
  var plain = _ccDecryptCbc(kv.subarray(0, 32), kv.subarray(32, 48), ct);
  var text = _ccBytesUtf8(plain);
  if (!text || text.length < 2) throw new Error("CookieCloud 解密为空（UUID/密码不匹配）");
  return JSON.parse(text);
}

// 从解密结果里取豆瓣相关域名下的全部 cookie，拼成 Cookie 头；同时拿到 ck
function ccPickDoubanCookies(payload) {
  var data = payload && payload.cookie_data ? payload.cookie_data : payload;
  if (!data || typeof data !== "object") return null;
  var best = null, bestScore = -1;
  Object.keys(data).forEach(function (dom) {
    if (String(dom).toLowerCase().indexOf("douban") < 0) return;
    var list = data[dom];
    if (!Array.isArray(list)) return;
    var pairs = [], hasDbcl2 = false;
    list.forEach(function (c) {
      if (!c || !c.name || c.value === undefined || c.value === null) return;
      pairs.push(c.name + "=" + c.value);
      if (c.name === "dbcl2") hasDbcl2 = true;
    });
    var score = pairs.length + (hasdbcl2Score(hasDbcl2));
    if (score > bestScore) {
      bestScore = score;
      best = pairs;
    }
  });
  if (!best || !best.length) return null;
  var header = best.join("; ");
  var m = /(?:^|;\s*)ck=([^;]+)/.exec(header);
  return { cookie: header, ck: m ? m[1] : "" };
}
function hasdbcl2Score(v) {
  return v ? 1000 : 0;
}

// ==================== 数据源 ====================

function _p(params, key) {
  var v = params && params[key] !== undefined && params[key] !== null ? params[key] : "";
  return String(v).trim();
}
function _host(h) {
  var s = (h || "").trim().replace(/\/+$/, "");
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  var m = /^(https?:\/\/[^\/?#]+)(\/[^?#]*)?$/i.exec(s);
  if (!m) return "";
  var path = m[2] || "";
  if (!path || path === "/") path = "/cookiecloud";
  return m[1] + path;
}
async function _cacheGet(k) {
  try {
    var v = await Widget.storage.get(k);
    return v === undefined ? null : v;
  } catch (e) {
    return null;
  }
}
async function _cacheSet(k, v, ttl) {
  try {
    await Widget.storage.set(k, v, { ttl: ttl });
  } catch (e) {
    try {
      await Widget.storage.set(k, v);
    } catch (e2) {}
  }
}

async function resolveDoubanCookie(params) {
  var host = _host(_p(params, "cc_host"));
  var uuid = _p(params, "cc_uuid");
  var pwd = _p(params, "cc_password");

  if (host && uuid && pwd) {
    var key = "cc:douban:" + host + "|" + uuid + "|" + _ccHex(_ccMd5(_ccUtf8Bytes(host + uuid + pwd))).slice(0, 8);
    var cached = await _cacheGet(key);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }
    try {
      var res = await Widget.http.get(host + "/get/" + encodeURIComponent(uuid));
      var body = res && res.data !== undefined ? res.data : res;
      if (typeof body === "string") body = JSON.parse(body);
      if (body && body.encrypted) {
        if (body.crypto_type && body.crypto_type !== "legacy") {
          console.log("[CookieCloud] crypto_type=" + body.crypto_type + "，只支持 legacy");
        }
        var payload = ccDecryptLegacy(body.encrypted, uuid, pwd);
        var picked = ccPickDoubanCookies(payload);
        if (picked) {
          await _cacheSet(key, JSON.stringify(picked), 21600000);
          console.log("[CookieCloud] 取到豆瓣 cookie，长度 " + picked.cookie.length + "，ck=" + (picked.ck ? "有" : "无"));
          return picked;
        }
        console.log("[CookieCloud] 解密成功但没找到豆瓣 cookie");
      }
    } catch (e) {
      console.error("[CookieCloud] 获取失败：" + (e && e.message ? e.message : e));
    }
  }

  var manual = _p(params, "cookie");
  if (manual) {
    var m = /(?:^|;\s*)ck=([^;]+)/.exec(manual);
    return { cookie: manual, ck: m ? m[1] : "" };
  }
  return null;
}

async function loadSuggestionItems(params = {}) {
  var type = _p(params, "type") === "tv" ? "tv" : "movie";
  var page = Number(params.page) || 1;
  var count = 40;
  var start = (page - 1) * count;

  var cred = await resolveDoubanCookie(params);
  var url =
    "https://m.douban.com/rexxar/api/v2/" +
    type +
    "/recommend?start=" +
    start +
    "&count=" +
    count +
    "&ck=" +
    (cred && cred.ck ? encodeURIComponent(cred.ck) : "");

  var headers = {
    Referer: "https://m.douban.com/movie",
    "User-Agent": DB_UA,
    "X-Requested-With": "XMLHttpRequest",
  };
  if (cred && cred.cookie) headers.Cookie = cred.cookie;

  var res = await Widget.http.get(url, { headers: headers });
  var data = res && res.data !== undefined ? res.data : res;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch (e) {
      data = null;
    }
  }
  if (!data || !data.items) {
    console.log("[豆瓣推荐] 无数据返回");
    return [];
  }

  var out = [], seen = {};
  data.items.forEach(function (it) {
    if (!it || it.id === undefined || it.id === null) return;
    if (it.type !== "movie" && it.type !== "tv") return;
    var id = String(it.id);
    if (seen[id]) return;
    seen[id] = 1;
    out.push({ id: id, type: "douban" });
  });
  console.log("[豆瓣推荐] 返回 " + out.length + " 条（登录态：" + (cred ? "有" : "无") + "）");
  return out;
}
