const UA = 'Dart/3.3'

WidgetMetadata = {
  id: "one_vod_pro_optimized",
  title: "ONE+ 优化版",
  icon: "https://assets.vvebo.vip/scripts/icon.png",
  version: "2.0.0",
  requiredVersion: "0.0.2",
  description: "获取One付费资源 - 优化减少点数消耗",
  author: "Zen",
  site: "https://github.com/zenmic7",
  globalParams: [
    {
      name: "token",
      title: "token ",
      type: "input",
      value: "",
      placeholder: "请输入口令"
    },
    {
      name: "site",
      title: "源站地址",
      type: "input",
      value: "https://vod.infiniteapi.com"
    },
    {
      name: "useCache",
      title: "启用缓存",
      type: "switch",
      value: true,
      description: "开启缓存减少重复请求"
    },
    {
      name: "searchMode",
      title: "搜索模式",
      type: "enumeration",
      value: "xml",
      enumOptions: [
        {
          value: "xml",
          title: "XML模式（不消耗点数）"
        },
        {
          value: "json",
          title: "JSON模式（消耗点数）"
        }
      ],
      description: "XML模式搜索不消耗点数，但需要点击播放"
    }
  ],
  modules: [
    {
      id: "loadResource",
      title: "加载资源",
      functionName: "loadResource",
      type: "stream",
      cacheDuration: 600,
      params: []
    },
    {
      id: "search",
      title: "搜索",
      functionName: "search",
      type: "stream",
      cacheDuration: 300,
      params: [
        {
          name: "keyword",
          title: "关键词",
          type: "input",
          value: ""
        }
      ]
    }
  ],
};

// --- 辅助函数 ---
function argsify(data) {
  if (typeof data === 'string') {
    try {
      return JSON.parse(data);
    } catch (e) {
      return {};
    }
  }
  return data;
}

// --- 数字转中文（支持1-99） ---
function toChineseNum(num) {
  const chars = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  if (num <= 10) return chars[num];
  if (num < 20) return "十" + chars[num % 10];
  return chars[Math.floor(num / 10)] + "十" + (num % 10 === 0 ? "" : chars[num % 10]);
}

// --- 智能匹配算法（金牌资源风格）---
function getPreciseMatch(list, params) {
  if (!list?.length) return null;

  const { seriesName, season, type } = params;
  const targetSeason = parseInt(season) || 1;
  const cnSeason = toChineseNum(targetSeason);
  
  let best = { item: null, score: -1 };

  for (const item of list) {
    const { title, descriptionText } = item;
    const fullText = `${title} ${descriptionText || ''}`;
    
    let score = 0;

    // 电影逻辑：名称完全匹配
    if (type === 'movie') {
      if (title === seriesName) {
        score = 100;
      } else if (title.includes(seriesName) || seriesName.includes(title)) {
        score = 50;
      }
    } 
    
    // 剧集逻辑：智能季数匹配
    else if (type === 'tv' || type === 'series') {
      if (targetSeason === 1) {
        // 第一季：名称完全一致，且没有其他季的干扰
        const otherSeasonReg = /第[二三四五六七八九十]季|S0?[2-9]/i;
        const isExactName = (title === seriesName);
        const hasSeasonSuffix = fullText.match(otherSeasonReg);
        
        if (isExactName && !hasSeasonSuffix) {
          score = 90;
        } else if (title.includes(seriesName) && !title.includes(`${seriesName}2`) && !hasSeasonSuffix) {
          score = 30;
        }
      } else {
        // 多季匹配：支持"剧名2"、"剧名第二季"
        const seasonPatterns = [
          `${targetSeason}`, 
          `第${targetSeason}季`, 
          `第${cnSeason}季`,
          `S0?${targetSeason}`
        ];
        
        const seasonReg = new RegExp(`${seriesName}.*?(${seasonPatterns.join('|')})`, 'i');
        
        if (seasonReg.test(title)) {
          score = 90;
        } else if (descriptionText && seasonReg.test(descriptionText)) {
          score = 80;
        } else if (seasonPatterns.some(p => fullText.includes(p)) && title.includes(seriesName)) {
          score = 30;
        }
      }
      score += 10; // 类型匹配基础分
    }

    if (score > best.score) {
      best = { item, score };
    }
  }

  return best.score >= 50 ? best.item : null;
}

// --- 获取播放地址（消耗点数）---
async function getOneSourcePlayInfo(url) {
  try {
    const res = await Widget.http.get(url, {
      headers: { 'User-Agent': UA },
      timeout: 8000
    });
    
    const data = argsify(res.data);
    if (data && data.playurl) {
      return { url: data.playurl };
    }
    return null;
  } catch (error) {
    console.error(`获取播放信息失败: ${error.message}`);
    return null;
  }
}

// --- 使用XML API搜索（不消耗点数）---
async function searchWithXmlApi(token, site, keyword) {
  try {
    const searchUrl = `${site}/${token}/one_vod?wd=${encodeURIComponent(keyword)}&ac=videolist`;
    const response = await Widget.http.get(searchUrl, {
      headers: { 'User-Agent': UA },
      timeout: 10000
    });
    
    const xmlData = response.data;
    if (!xmlData) return [];
    
    // 解析XML格式
    const videoMatches = xmlData.match(/<video>([\s\S]*?)<\/video>/g) || [];
    
    return videoMatches.map(videoXml => {
      const nameMatch = videoXml.match(/<name><!\[CDATA\[(.*?)\]\]><\/name>/);
      const idMatch = videoXml.match(/<id>(.*?)<\/id>/);
      const picMatch = videoXml.match(/<pic>(.*?)<\/pic>/);
      const typeMatch = videoXml.match(/<type>(.*?)<\/type>/);
      const noteMatch = videoXml.match(/<note>(.*?)<\/note>/);
      
      if (!idMatch || !nameMatch) return null;
      
      const id = idMatch[1].trim();
      const title = nameMatch[1].trim();
      const type = typeMatch ? typeMatch[1].trim() : "unknown";
      
      // XML API的详情页URL格式不同
      const detailUrl = `${site}/${token}/one_vod?ac=videolist&ids=${id}`;
      
      return {
        id: id,
        title: title,
        descriptionText: noteMatch ? noteMatch[1].trim() : "",
        coverURLString: picMatch ? picMatch[1].trim() : "",
        type: type,
        detailURLString: detailUrl,
        // 为兼容智能匹配算法添加的字段
        ext: {
          url: detailUrl,
          detailUrl: detailUrl,
          mediaType: type === 'movie' ? 'movie' : 'tv'
        }
      };
    }).filter(Boolean);
    
  } catch (error) {
    console.error(`XML API搜索失败: ${error.message}`);
    return [];
  }
}

// --- 解析XML详情页获取播放地址（不消耗点数）---
async function getPlayInfoFromXmlDetail(url) {
  try {
    const response = await Widget.http.get(url, {
      headers: { 'User-Agent': UA },
      timeout: 10000
    });
    
    const xmlData = response.data;
    if (!xmlData) return null;
    
    // 查找播放数据
    const ddMatches = xmlData.match(/<dd[^>]*>\s*<!\[CDATA\[(.*?)\]\]>\s*<\/dd>/g) || [];
    if (ddMatches.length === 0) return null;
    
    const firstMatch = ddMatches[0];
    const contentMatch = firstMatch.match(/<!\[CDATA\[(.*?)\]\]>/);
    if (!contentMatch) return null;
    
    const playData = contentMatch[1].trim();
    const episodes = playData.split('#').filter(item => item && item.includes('$'));
    
    if (episodes.length === 0) return null;
    
    // 返回第一个播放地址
    const firstEpisode = episodes[0];
    const parts = firstEpisode.split('$');
    if (parts.length >= 2) {
      return { url: parts[1].trim() };
    }
    
    return null;
  } catch (error) {
    console.error(`解析XML详情失败: ${error.message}`);
    return null;
  }
}

// --- 缓存管理 ---
const playInfoCache = new Map();

function getCacheKey(url) {
  return `playinfo_${url}`;
}

function getFromCache(url) {
  const cacheKey = getCacheKey(url);
  const cached = playInfoCache.get(cacheKey);
  if (cached && cached.expire > Date.now()) {
    console.log(`命中缓存: ${cacheKey}`);
    return cached.data;
  }
  return null;
}

function setToCache(url, data, ttl = 1800000) { // 默认30分钟
  const cacheKey = getCacheKey(url);
  playInfoCache.set(cacheKey, {
    data: data,
    expire: Date.now() + ttl
  });
}

// --- 主函数：加载资源（优化版）---
async function loadResource(params) {
  const { seriesName, episode, season, type = 'tv', token, site, useCache = true, searchMode = 'xml' } = params;
  
  if (!token) {
    console.error("请先在设置中填入token口令");
    return [];
  }
  
  if (!seriesName) {
    console.error("需要提供影片名称");
    return [];
  }
  
  try {
    let searchList = [];
    
    // 方法1：XML模式（不消耗点数）
    if (searchMode === 'xml') {
      console.log(`使用XML模式搜索: ${seriesName}`);
      searchList = await searchWithXmlApi(token, site, seriesName);
    }
    // 方法2：JSON模式（消耗点数）
    else {
      console.log(`使用JSON模式搜索: ${seriesName}（可能消耗点数）`);
      const searchUrl = `${site}/${token}/one_vod_json_new?ac=videolist&wd=${encodeURIComponent(seriesName)}`;
      const searchRes = await Widget.http.get(searchUrl, {
        headers: { 'User-Agent': UA },
        timeout: 10000
      });
      
      searchList = argsify(searchRes.data);
    }
    
    if (!searchList || searchList.length === 0) {
      console.log(`未找到影片: ${seriesName}`);
      return [];
    }
    
    // 智能匹配最佳结果
    const bestMatch = getPreciseMatch(searchList, { seriesName, season, type });
    if (!bestMatch) {
      console.log(`未找到匹配的影片: ${seriesName}`);
      return [];
    }
    
    // 检查缓存
    if (useCache) {
      const cachedResult = getFromCache(bestMatch.detailURLString);
      if (cachedResult) {
        console.log(`使用缓存的播放地址`);
        return [cachedResult];
      }
    }
    
    // XML模式：直接从详情页解析播放地址（不消耗点数）
    if (searchMode === 'xml') {
      console.log(`尝试从XML详情页获取播放地址: ${bestMatch.detailURLString}`);
      const playInfo = await getPlayInfoFromXmlDetail(bestMatch.detailURLString);
      
      if (playInfo && playInfo.url) {
        const result = {
          name: "ONE源",
          description: `${bestMatch.title} - 正片`,
          url: playInfo.url
        };
        
        // 缓存结果
        if (useCache) {
          setToCache(bestMatch.detailURLString, result);
        }
        
        return [result];
      }
      
      // XML模式失败，尝试JSON模式
      console.log(`XML模式失败，尝试JSON模式获取播放地址`);
    }
    
    // JSON模式或XML模式失败时：获取剧集列表（可能消耗点数）
    console.log(`获取详情页: ${bestMatch.detailURLString}（可能消耗点数）`);
    const detailRes = await Widget.http.get(bestMatch.detailURLString, {
      headers: { 'User-Agent': UA },
      timeout: 10000
    });
    
    const episodes = argsify(detailRes.data);
    if (!episodes || episodes.length === 0) {
      console.log(`影片没有可用的剧集: ${bestMatch.title}`);
      return [];
    }
    
    // 根据类型处理播放地址
    const results = [];
    
    if (type === 'movie') {
      // 电影：直接取第一个播放地址
      const playInfo = await getOneSourcePlayInfo(episodes[0].episodeDetailURL);
      if (playInfo && playInfo.url) {
        const result = {
          name: "One源",
          description: `${bestMatch.title} - 正片`,
          url: playInfo.url
        };
        
        // 缓存结果
        if (useCache) {
          setToCache(bestMatch.detailURLString, result);
        }
        
        results.push(result);
      }
    } else {
      // 剧集：根据集数匹配
      let targetEpisode = episodes[0];
      
      if (episode) {
        // 尝试精确匹配集数
        const epNum = parseInt(episode);
        targetEpisode = episodes.find(ep => {
          const epMatch = ep.title.match(/第(\d+)集/);
          return epMatch && parseInt(epMatch[1]) === epNum;
        }) || episodes[0];
      }
      
      const playInfo = await getOneSourcePlayInfo(targetEpisode.episodeDetailURL);
      if (playInfo && playInfo.url) {
        const result = {
          name: "ONE",
          description: `${bestMatch.title} - ${targetEpisode.title}`,
          url: playInfo.url
        };
        
        // 缓存结果
        if (useCache) {
          setToCache(bestMatch.detailURLString, result);
        }
        
        results.push(result);
      }
    }
    
    return results;
    
  } catch (error) {
    console.error(`加载资源失败: ${error.message}`);
    return [];
  }
}

// --- 搜索函数（优化版，支持两种模式）---
async function search(params) {
  const { keyword, token, site, searchMode = 'xml' } = params;
  
  if (!keyword || !keyword.trim()) {
    return [];
  }
  
  if (!token) {
    console.error("请先在设置中填入token口令");
    return [];
  }
  
  try {
    let searchList = [];
    
    // XML模式（不消耗点数）
    if (searchMode === 'xml') {
      searchList = await searchWithXmlApi(token, site, keyword.trim());
    }
    // JSON模式（消耗点数）
    else {
      const searchUrl = `${site}/${token}/one_vod_json_new?ac=videolist&wd=${encodeURIComponent(keyword.trim())}`;
      const searchRes = await Widget.http.get(searchUrl, {
        headers: { 'User-Agent': UA },
        timeout: 10000
      });
      
      searchList = argsify(searchRes.data);
    }
    
    if (!searchList || searchList.length === 0) {
      return [];
    }
    
    // 转换为Forward期望的搜索卡片格式
    const results = searchList.map(item => ({
      id: String(item.id || Date.now() + Math.random()),
      title: item.title || "",
      description: item.descriptionText || "",
      cover: item.coverURLString || "",
      type: "video",
      ext: {
        url: item.detailURLString || item.ext?.url || "",
        detailUrl: item.detailURLString || item.ext?.detailUrl || "",
        title: item.title || "",
        mediaType: item.ext?.mediaType || (item.type === 'movie' ? 'movie' : 'tv')
      }
    }));
    
    return results;
    
  } catch (error) {
    console.error(`搜索失败: ${error.message}`);
    return [];
  }
}

// --- 测试连接函数（可选）---
async function testConnection(params) {
  const { token, site } = params;
  
  if (!token) {
    return "请先设置token";
  }
  
  try {
    const testUrl = `${site}/${token}/one_vod?ac=videolist&pg=1`;
    const response = await Widget.http.get(testUrl, {
      headers: { 'User-Agent': UA },
      timeout: 5000
    });
    
    if (response && response.data) {
      return "✅ 连接成功！ONE源可用";
    } else {
      return "❌ 连接失败，请检查token";
    }
  } catch (error) {
    return `❌ 连接失败: ${error.message}`;
  }
}
