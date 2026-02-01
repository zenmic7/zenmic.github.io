const UA = 'Dart/3.3';
const DEFAULT_HEADERS = {
  'Accept-Language': 'zh-CN,zh;q=0.9,zh-TW;q=0.8,en;q=0.7',
  'User-Agent': UA
};

WidgetMetadata = {
  id: "one_vod_complete",
  title: "ONE+ 完整版",
  icon: "https://assets.vvebo.vip/scripts/icon.png",
  version: "3.0.0",
  requiredVersion: "0.0.2",
  description: "ONE资源 - 搜索不消耗点数，播放功能正常",
  author: "Zen",
  site: "https://vod.infiniteapi.com",
  detailCacheDuration: 1,
  globalParams: [
    {
      name: "token",
      title: "token口令",
      type: "input",
      value: "",
      placeholder: "在Telegram bot @Infinite_SyncNext_bot 获取token"
    },
    {
      name: "site",
      title: "源站地址",
      type: "input",
      value: "https://vod.infiniteapi.com"
    },
    {
      name: "debug",
      title: "调试模式",
      type: "switch",
      value: false,
      description: "开启详细日志"
    }
  ],
  modules: [
    {
      id: "loadResource",
      title: "ONE资源",
      functionName: "loadResource",
      type: "stream",
      cacheDuration: 600,
      params: []
    },
    {
      id: "search",
      title: "搜索",
      functionName: "search",
      type: "search",
      params: [
        {
          name: 'keyword',
          title: '关键词',
          type: 'input',
          value: ''
        },
        {
          name: 'page',
          title: '页码',
          type: 'page',
          value: '1'
        }
      ]
    }
  ],
  loadDetail: "loadDetail"
};

// ========== 核心功能函数 ==========

// --- 搜索函数（不消耗点数）---
async function search(params) {
  const { token, site, keyword, page = 1, debug = false } = params;
  
  if (!token) {
    return [];
  }
  
  if (!keyword || !keyword.trim()) {
    return [];
  }
  
  try {
    if (debug) console.log(`搜索关键词: ${keyword}`);
    
    const searchUrl = `${site}/${token}/one_vod?wd=${encodeURIComponent(keyword.trim())}&ac=videolist&pg=${page}`;
    if (debug) console.log(`搜索URL: ${searchUrl}`);
    
    const response = await Widget.http.get(searchUrl, {
      headers: DEFAULT_HEADERS,
      timeout: 15000
    });
    
    if (!response || !response.data) {
      return [];
    }
    
    const items = parseSearchXml(response.data, token, site, debug);
    if (debug) console.log(`搜索到 ${items.length} 个结果`);
    
    return items;
    
  } catch (error) {
    if (debug) console.error(`搜索失败: ${error.message}`);
    return [];
  }
}

// --- 解析搜索结果的XML ---
function parseSearchXml(xmlData, token, site, debug = false) {
  const videoMatches = xmlData.match(/<video>([\s\S]*?)<\/video>/g) || [];
  if (debug) console.log(`找到 ${videoMatches.length} 个<video>标签`);
  
  const items = videoMatches.map((videoXml) => {
    try {
      const nameMatch = videoXml.match(/<name><!\[CDATA\[(.*?)\]\]><\/name>/);
      const idMatch = videoXml.match(/<id>(.*?)<\/id>/);
      const picMatch = videoXml.match(/<pic>(.*?)<\/pic>/);
      const typeMatch = videoXml.match(/<type>(.*?)<\/type>/);
      const yearMatch = videoXml.match(/<year>(.*?)<\/year>/);
      const noteMatch = videoXml.match(/<note>(.*?)<\/note>/);
      
      if (!idMatch || !nameMatch) {
        return null;
      }
      
      const id = idMatch[1].trim();
      const title = nameMatch[1].trim();
      const type = typeMatch ? typeMatch[1].trim() : "unknown";
      const mediaType = (type === 'movie' || title.includes('电影')) ? 'movie' : 'tv';
      
      const detailUrl = `${site}/${token}/one_vod?ac=videolist&ids=${id}`;
      
      return {
        id: id,
        title: title,
        description: noteMatch ? noteMatch[1].trim() : (yearMatch ? `年份: ${yearMatch[1].trim()}` : ""),
        cover: picMatch ? picMatch[1].trim() : "",
        type: "video",
        ext: {
          url: detailUrl,
          detailUrl: detailUrl,
          title: title,
          mediaType: mediaType,
          type: type
        }
      };
    } catch (e) {
      if (debug) console.error("解析视频失败:", e);
      return null;
    }
  }).filter(Boolean);
  
  return items;
}

// --- loadResource函数（Forward资源模块入口）---
async function loadResource(params) {
  const { seriesName, episode, season, type = 'tv', token, site, debug = false } = params;
  
  if (!token) {
    return [];
  }
  
  if (!seriesName) {
    return [];
  }
  
  if (debug) console.log(`loadResource调用: ${seriesName}, 类型: ${type}`);
  
  try {
    const searchResults = await search({ 
      token, 
      site, 
      keyword: seriesName,
      page: 1,
      debug 
    });
    
    if (searchResults.length === 0) {
      return [];
    }
    
    // 智能匹配最佳结果
    const bestMatch = smartMatch(searchResults, seriesName, season, type, debug);
    
    if (!bestMatch) {
      return [];
    }
    
    return [{
      name: "ONE源",
      description: `${bestMatch.title} - 点击播放`,
      url: bestMatch.ext.detailUrl,
      ext: {
        detailUrl: bestMatch.ext.detailUrl,
        title: bestMatch.title,
        mediaType: bestMatch.ext.mediaType || 'tv',
        type: bestMatch.ext.type || 'unknown'
      }
    }];
    
  } catch (error) {
    if (debug) console.error(`loadResource失败: ${error.message}`);
    return [];
  }
}

// --- 智能匹配函数 ---
function smartMatch(results, seriesName, season, type, debug = false) {
  if (!results || results.length === 0) {
    return null;
  }
  
  // 简单匹配：优先名称包含关键词的
  for (const item of results) {
    const title = item.title || "";
    const itemType = item.ext?.type || "unknown";
    
    // 类型匹配
    const typeMatch = (type === 'movie' && itemType === 'movie') || 
                     (type !== 'movie' && itemType !== 'movie');
    
    if (typeMatch && title.includes(seriesName)) {
      if (debug) console.log(`智能匹配成功: ${title}`);
      return item;
    }
  }
  
  // 如果没找到，返回第一个
  if (debug) console.log(`使用第一个结果: ${results[0].title}`);
  return results[0];
}

// --- loadDetail函数（Forward播放时调用）---
async function loadDetail(url) {
  try {
    console.log("loadDetail调用，URL:", url);
    
    // 验证URL格式
    if (!url || !url.includes('one_vod')) {
      console.error("无效的详情页URL");
      return null;
    }
    
    // 获取详情页数据
    const response = await Widget.http.get(url, {
      headers: DEFAULT_HEADERS,
      timeout: 20000
    });
    
    if (!response || !response.data) {
      console.error("详情页返回空数据");
      return null;
    }
    
    // 解析详情页XML
    const detailResult = parseDetailXml(response.data);
    
    if (!detailResult) {
      console.error("解析详情页失败");
      return null;
    }
    
    console.log("详情解析成功");
    return detailResult;
    
  } catch (error) {
    console.error("加载详情失败:", error.message);
    return null;
  }
}

// --- 解析详情页XML ---
function parseDetailXml(xmlData) {
  try {
    // 提取基本信息
    const idMatch = xmlData.match(/<id>(.*?)<\/id>/);
    const nameMatch = xmlData.match(/<name><!\[CDATA\[(.*?)\]\]><\/name>/);
    const typeMatch = xmlData.match(/<type>(.*?)<\/type>/);
    
    const videoId = idMatch ? idMatch[1].trim() : "unknown";
    const videoName = nameMatch ? nameMatch[1].trim() : "未知影片";
    const videoType = typeMatch ? typeMatch[1].trim() : "tv";
    const isMovie = videoType === 'movie';
    
    console.log(`影片信息: ${videoName}, 类型: ${videoType}`);
    
    // 查找播放数据
    let playData = null;
    
    // 尝试多种匹配方式
    const ddPatterns = [
      /<dd[^>]*>\s*<!\[CDATA\[(.*?)\]\]>\s*<\/dd>/g,
      /<dd>\s*<!\[CDATA\[(.*?)\]\]>\s*<\/dd>/g,
      /dd.*?<!\[CDATA\[(.*?)\]\]>/g
    ];
    
    for (const pattern of ddPatterns) {
      const matches = xmlData.match(pattern);
      if (matches && matches.length > 0) {
        const contentMatch = matches[0].match(/<!\[CDATA\[(.*?)\]\]>/);
        if (contentMatch && contentMatch[1]) {
          playData = contentMatch[1].trim();
          console.log("找到播放数据");
          break;
        }
      }
    }
    
    if (!playData) {
      console.error("未找到播放数据");
      return null;
    }
    
    // 解析播放数据
    const episodeData = parsePlayData(playData, videoId, videoName, isMovie);
    
    if (!episodeData) {
      console.error("解析播放数据失败");
      return null;
    }
    
    // 构建Forward要求的返回格式
    const result = {
      id: videoId,
      type: 'detail',
      mediaType: isMovie ? 'movie' : 'tv',
      title: videoName,
      playerType: "app"
    };
    
    if (isMovie) {
      // 电影格式
      if (episodeData.videoUrl) {
        result.videoUrl = episodeData.videoUrl;
      }
    } else {
      // 电视剧格式
      if (episodeData.episodeItems && episodeData.episodeItems.length > 0) {
        result.videoUrl = episodeData.episodeItems[0].videoUrl;
        result.episodeItems = episodeData.episodeItems;
        result.episode = episodeData.episodeItems.length;
      }
    }
    
    return result;
    
  } catch (error) {
    console.error("解析详情XML时出错:", error.message);
    return null;
  }
}

// --- 解析播放数据 ---
function parsePlayData(playData, videoId, videoName, isMovie) {
  try {
    console.log("开始解析播放数据...");
    
    // 清理和分割数据
    const cleanData = playData.replace(/[\r\n]+/g, '#');
    const episodes = cleanData.split('#').filter(item => {
      return item && item.includes('$') && item.trim().length > 5;
    });
    
    console.log(`分割出 ${episodes.length} 个剧集`);
    
    if (episodes.length === 0) {
      console.error("没有有效的剧集数据");
      return null;
    }
    
    // 处理电影
    if (isMovie || episodes.length === 1) {
      const parts = episodes[0].split('$');
      if (parts.length >= 2) {
        const title = parts[0].trim() || videoName;
        const videoUrl = parts[1].trim();
        
        if (isValidVideoUrl(videoUrl)) {
          console.log(`电影播放地址获取成功: ${videoUrl.substring(0, 60)}...`);
          return {
            videoUrl: videoUrl,
            title: title
          };
        }
      }
    }
    
    // 处理电视剧
    const episodeItems = [];
    
    for (let i = 0; i < episodes.length; i++) {
      const episode = episodes[i];
      const parts = episode.split('$');
      
      if (parts.length >= 2) {
        const epTitle = parts[0].trim() || `第 ${i + 1} 集`;
        const epUrl = parts[1].trim();
        
        if (isValidVideoUrl(epUrl)) {
          episodeItems.push({
            id: `${videoId}|${i}`,
            title: epTitle,
            videoUrl: epUrl,
            mediaType: 'episode'
          });
        }
      }
    }
    
    if (episodeItems.length === 0) {
      console.error("没有有效的剧集");
      return null;
    }
    
    console.log(`共解析 ${episodeItems.length} 个有效剧集`);
    return {
      episodeItems: episodeItems
    };
    
  } catch (error) {
    console.error("解析播放数据失败:", error.message);
    return null;
  }
}

// --- 验证视频URL是否有效 ---
function isValidVideoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  const urlStr = url.trim().toLowerCase();
  
  // 常见视频格式和协议
  const validPatterns = [
    /^https?:\/\//,
    /\.m3u8($|\?)/,
    /\.mp4($|\?)/,
    /\.flv($|\?)/,
    /\.ts($|\?)/,
    /rtmp:\/\//,
    /rtsp:\/\//
  ];
  
  return validPatterns.some(pattern => pattern.test(urlStr));
}

// ========== 辅助函数 ==========

// --- 数字转中文（用于智能匹配）---
function toChineseNum(num) {
  const chars = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  if (num <= 10) return chars[num];
  if (num < 20) return "十" + chars[num % 10];
  return chars[Math.floor(num / 10)] + "十" + (num % 10 === 0 ? "" : chars[num % 10]);
}

// --- 提取季信息 ---
function extractSeasonInfo(seriesName) {
  if (!seriesName) return { baseName: seriesName, seasonNumber: 1 };
  
  // 中文季数匹配
  const chineseMatch = seriesName.match(/第([一二三四五六七八九十\d]+)[季部]/);
  if (chineseMatch) {
    const val = chineseMatch[1];
    const seasonNum = parseInt(val) || 
      (val === '一' ? 1 : val === '二' ? 2 : val === '三' ? 3 : val === '四' ? 4 : 
       val === '五' ? 5 : val === '六' ? 6 : val === '七' ? 7 : val === '八' ? 8 : 
       val === '九' ? 9 : val === '十' ? 10 : 1);
    const baseName = seriesName.replace(/第[一二三四五六七八九十\d]+[季部]/, '').trim();
    return { baseName, seasonNumber: seasonNum };
  }
  
  // 数字季数匹配
  const digitMatch = seriesName.match(/(.+?)[\s_]*(S|Season|第?\s*)(\d+)/i);
  if (digitMatch) {
    return { baseName: digitMatch[1].trim(), seasonNumber: parseInt(digitMatch[3]) || 1 };
  }
  
  // 结尾数字匹配
  const endMatch = seriesName.match(/(.+?)(\d+)$/);
  if (endMatch) {
    return { baseName: endMatch[1].trim(), seasonNumber: parseInt(endMatch[2]) || 1 };
  }
  
  return { baseName: seriesName.trim(), seasonNumber: 1 };
}

// --- 测试连接函数 ---
async function testConnection(params) {
  const { token, site } = params;
  
  if (!token) {
    return "请先设置token";
  }
  
  try {
    const testUrl = `${site}/${token}/one_vod?ac=videolist&pg=1`;
    const response = await Widget.http.get(testUrl, {
      headers: DEFAULT_HEADERS,
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
