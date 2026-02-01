const UA = 'Dart/3.3';
const DEFAULT_HEADERS = {
  'Accept-Language': 'zh-CN,zh;q=0.9,zh-TW;q=0.8,en;q=0.7',
  'User-Agent': UA
};

WidgetMetadata = {
  id: "one_vod_pro_optimized",
  title: "ONE+ 优化版",
  icon: "https://assets.vvebo.vip/scripts/icon.png",
  version: "2.0.0",
  requiredVersion: "0.0.2",
  description: "获取One付费资源 - 优化版不消耗点数",
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
    }
  ],
  modules: [
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
    },
    {
      id: "loadResource",
      title: "加载资源",
      functionName: "loadResource",
      type: "stream",
      cacheDuration: 600,
      params: [
        {
          name: "mode",
          title: "模式",
          type: "enumeration",
          value: "search",
          enumOptions: [
            { value: "search", title: "智能搜索模式" },
            { value: "direct", title: "直接播放模式" }
          ]
        }
      ]
    }
  ],
  // 关键声明：告诉Forward这个脚本有loadDetail函数
  loadDetail: "loadDetail"
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

// --- 搜索函数（不消耗点数）---
async function search(params) {
  const { token, site, keyword, page = 1 } = params;
  
  if (!token) {
    console.error("请先在设置中填入token口令");
    return [];
  }
  
  if (!keyword || !keyword.trim()) {
    return [];
  }
  
  try {
    // 方法1：尝试JSON API
    const jsonUrl = `${site}/${token}/one_vod_json_new?ac=videolist&wd=${encodeURIComponent(keyword.trim())}&pg=${page}`;
    let searchList = [];
    
    try {
      const searchRes = await Widget.http.get(jsonUrl, {
        headers: DEFAULT_HEADERS,
        timeout: 10000
      });
      searchList = argsify(searchRes.data);
    } catch (jsonError) {
      console.log("JSON API失败，尝试XML API:", jsonError.message);
    }
    
    // 如果JSON API失败或无结果，尝试XML API
    if (!searchList || searchList.length === 0) {
      const xmlUrl = `${site}/${token}/one_vod?wd=${encodeURIComponent(keyword.trim())}&ac=videolist&pg=${page}`;
      const xmlRes = await Widget.http.get(xmlUrl, {
        headers: DEFAULT_HEADERS,
        timeout: 10000
      });
      
      // 解析XML
      searchList = parseXmlVideoList(xmlRes.data, token, site);
    }
    
    if (!searchList || searchList.length === 0) {
      console.log(`未找到相关影片: ${keyword}`);
      return [];
    }
    
    // 转换为Forward期望的格式
    return searchList.map(item => ({
      id: String(item.id || Date.now() + Math.random()),
      title: item.title || item.name || "",
      description: item.descriptionText || item.year || "",
      cover: item.coverURLString || item.pic || "",
      type: "video",
      ext: {
        url: item.detailURLString || item.link || "",
        detailUrl: item.detailURLString || item.link || "",
        title: item.title || item.name || "",
        mediaType: (item.type === 'movie' || (item.title && item.title.includes('电影'))) ? 'movie' : 'tv'
      }
    }));
    
  } catch (error) {
    console.error(`搜索失败: ${error.message}`);
    return [];
  }
}

// --- 解析XML视频列表 ---
function parseXmlVideoList(xmlData, token, site) {
  const videoMatches = xmlData.match(/<video>([\s\S]*?)<\/video>/g) || [];
  
  return videoMatches.map(videoXml => {
    try {
      const nameMatch = videoXml.match(/<name><!\[CDATA\[(.*?)\]\]><\/name>/);
      const idMatch = videoXml.match(/<id>(.*?)<\/id>/);
      const picMatch = videoXml.match(/<pic>(.*?)<\/pic>/);
      const typeMatch = videoXml.match(/<type>(.*?)<\/type>/);
      const yearMatch = videoXml.match(/<year>(.*?)<\/year>/);
      const noteMatch = videoXml.match(/<note>(.*?)<\/note>/);
      
      if (!idMatch) return null;
      
      const id = idMatch[1];
      const title = nameMatch ? nameMatch[1] : "";
      const type = typeMatch ? typeMatch[1] : "unknown";
      
      return {
        id: id,
        title: title,
        name: title, // 兼容字段
        descriptionText: noteMatch ? noteMatch[1] : (yearMatch ? `年份: ${yearMatch[1]}` : ""),
        year: yearMatch ? yearMatch[1] : "",
        type: type,
        coverURLString: picMatch ? picMatch[1] : "",
        pic: picMatch ? picMatch[1] : "", // 兼容字段
        detailURLString: `${site}/${token}/one_vod?ac=videolist&ids=${id}`,
        link: `${site}/${token}/one_vod?ac=videolist&ids=${id}` // 兼容字段
      };
    } catch (e) {
      console.error("解析XML失败:", e);
      return null;
    }
  }).filter(Boolean);
}

// --- 加载详情（只有点击播放时才消耗点数）---
async function loadDetail(url) {
  try {
    console.log("loadDetail调用，URL:", url);
    
    const response = await Widget.http.get(url, {
      headers: DEFAULT_HEADERS,
      timeout: 10000
    });
    
    return parseDetailXml(response.data);
  } catch (error) {
    console.error("加载详情失败:", error);
    return null;
  }
}

// --- 解析详情页XML ---
function parseDetailXml(xmlData) {
  try {
    const idMatch = xmlData.match(/<id>(.*?)<\/id>/);
    const nameMatch = xmlData.match(/<name><!\[CDATA\[(.*?)\]\]><\/name>/);
    const ddMatches = xmlData.match(/<dd flag="">\s*<!\[CDATA\[(.*?)\]\]>\s*<\/dd>/g) || [];
    
    if (ddMatches.length === 0) {
      console.error("详情页中没有播放数据");
      return null;
    }
    
    const firstMatch = ddMatches[0];
    const contentMatch = firstMatch.match(/<!\[CDATA\[(.*?)\]\]>/);
    
    if (!contentMatch) {
      console.error("无法提取CDATA内容");
      return null;
    }
    
    const content = contentMatch[1];
    const episodes = content.split('#').filter(Boolean);
    
    // 电影：单集
    if (episodes.length === 1) {
      const parts = episodes[0].split('$');
      if (parts.length >= 2) {
        const title = parts[0] || (nameMatch ? nameMatch[1] : "ONE电影");
        const playUrl = parts[1];
        
        console.log("解析到电影播放地址:", playUrl.substring(0, 50) + "...");
        
        return {
          id: idMatch ? idMatch[1] : "unknown",
          type: 'detail',
          mediaType: 'movie',
          title: title,
          videoUrl: playUrl,
          playerType: "app"
        };
      }
    }
    // 电视剧：多集
    else {
      const episodeItems = episodes.map((episodeString, index) => {
        const parts = episodeString.split('$');
        if (parts.length >= 2) {
          return {
            id: `${idMatch ? idMatch[1] : 'unknown'}|${index}`,
            type: 'detail',
            title: parts[0] || `第 ${index + 1} 集`,
            videoUrl: parts[1],
            mediaType: 'episode'
          };
        }
        return null;
      }).filter(item => item && item.videoUrl);
      
      if (episodeItems.length === 0) {
        console.error("没有有效的剧集");
        return null;
      }
      
      console.log(`解析到${episodeItems.length}集剧集`);
      
      return {
        id: idMatch ? idMatch[1] : "unknown",
        type: 'detail',
        mediaType: 'tv',
        title: nameMatch ? nameMatch[1] : "ONE剧集",
        videoUrl: episodeItems[0].videoUrl,
        episodeItems: episodeItems,
        playerType: "app",
        episode: episodeItems.length
      };
    }
  } catch (error) {
    console.error("解析详情XML失败:", error);
    return null;
  }
}

// --- 智能匹配算法（可选保留）---
function toChineseNum(num) {
  const chars = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  if (num <= 10) return chars[num];
  if (num < 20) return "十" + chars[num % 10];
  return chars[Math.floor(num / 10)] + "十" + (num % 10 === 0 ? "" : chars[num % 10]);
}

// --- 兼容原loadResource函数 ---
async function loadResource(params) {
  const { seriesName, episode, season, type = 'tv', token, site, mode = 'search' } = params;
  
  if (!token) {
    console.error("请先在设置中填入token口令");
    return [];
  }
  
  if (!seriesName) {
    console.error("需要提供影片名称");
    return [];
  }
  
  // 模式1：智能搜索模式（先搜索，再匹配）
  if (mode === 'search') {
    // 先搜索
    const searchResults = await search({ 
      token, 
      site, 
      keyword: seriesName,
      page: 1 
    });
    
    if (searchResults.length === 0) {
      console.log(`未找到影片: ${seriesName}`);
      return [];
    }
    
    // 简单的智能匹配（可以后续完善）
    let bestMatch = searchResults[0];
    
    // 返回结果（现在只返回基本信息，不获取播放地址）
    return [{
      name: "ONE源",
      description: `${bestMatch.title} - 点击查看详情`,
      url: bestMatch.ext.detailUrl, // 这里是详情页URL，不是播放地址
      ext: {
        detailUrl: bestMatch.ext.detailUrl,
        title: bestMatch.title,
        mediaType: bestMatch.ext.mediaType
      }
    }];
  }
  
  // 模式2：直接播放模式（原逻辑，消耗点数）
  console.log("使用直接播放模式，可能会消耗点数");
  
  try {
    // 这里是您的原逻辑，会消耗点数
    const searchUrl = `${site}/${token}/one_vod_json_new?ac=videolist&wd=${encodeURIComponent(seriesName)}`;
    const searchRes = await Widget.http.get(searchUrl, {
      headers: DEFAULT_HEADERS,
      timeout: 10000
    });
    
    const searchList = argsify(searchRes.data);
    if (!searchList || searchList.length === 0) {
      return [];
    }
    
    // 智能匹配（简化版）
    const bestMatch = searchList[0];
    
    // 获取详情
    const detailRes = await Widget.http.get(bestMatch.detailURLString, {
      headers: DEFAULT_HEADERS,
      timeout: 10000
    });
    
    const episodes = argsify(detailRes.data);
    if (!episodes || episodes.length === 0) {
      return [];
    }
    
    // 获取播放地址（这里会消耗点数）
    const playInfo = await getOneSourcePlayInfo(episodes[0].episodeDetailURL);
    if (playInfo && playInfo.url) {
      return [{
        name: "ONE源",
        description: `${bestMatch.title} - 正片`,
        url: playInfo.url
      }];
    }
    
    return [];
    
  } catch (error) {
    console.error(`加载资源失败: ${error.message}`);
    return [];
  }
}

// --- 获取播放地址函数（原逻辑，消耗点数）---
async function getOneSourcePlayInfo(url) {
  try {
    const res = await Widget.http.get(url, {
      headers: DEFAULT_HEADERS,
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

// --- 初始化和测试代码 ---
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
      return "连接成功！可以正常使用ONE源";
    } else {
      return "连接失败，请检查token和网络";
    }
  } catch (error) {
    return `连接失败: ${error.message}`;
  }
}
