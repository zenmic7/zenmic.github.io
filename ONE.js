const UA = 'Dart/3.3';
const DEFAULT_HEADERS = {
  'Accept-Language': 'zh-CN,zh;q=0.9,zh-TW;q=0.8,en;q=0.7',
  'User-Agent': UA
};

WidgetMetadata = {
  id: "one_vod_pro_fixed",
  title: "ONE+ 修复版",
  icon: "https://assets.vvebo.vip/scripts/icon.png",
  version: "2.1.0",
  requiredVersion: "0.0.2",
  description: "ONE资源 - 修复播放错误问题",
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

// --- 搜索函数 ---
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
    console.log(`搜索关键词: ${keyword}`);
    
    // 使用XML API搜索
    const searchUrl = `${site}/${token}/one_vod?wd=${encodeURIComponent(keyword.trim())}&ac=videolist&pg=${page}`;
    console.log(`搜索URL: ${searchUrl}`);
    
    const response = await Widget.http.get(searchUrl, {
      headers: DEFAULT_HEADERS,
      timeout: 15000
    });
    
    if (!response || !response.data) {
      console.error("搜索返回空数据");
      return [];
    }
    
    console.log("搜索返回数据长度:", response.data.length);
    
    // 解析XML
    const items = parseSearchXml(response.data, token, site);
    console.log(`解析到 ${items.length} 个结果`);
    
    return items;
    
  } catch (error) {
    console.error(`搜索失败: ${error.message}`);
    return [];
  }
}

// --- 解析搜索结果的XML ---
function parseSearchXml(xmlData, token, site) {
  const videoMatches = xmlData.match(/<video>([\s\S]*?)<\/video>/g) || [];
  console.log(`找到 ${videoMatches.length} 个<video>标签`);
  
  const items = videoMatches.map((videoXml, index) => {
    try {
      const nameMatch = videoXml.match(/<name><!\[CDATA\[(.*?)\]\]><\/name>/);
      const idMatch = videoXml.match(/<id>(.*?)<\/id>/);
      const picMatch = videoXml.match(/<pic>(.*?)<\/pic>/);
      const typeMatch = videoXml.match(/<type>(.*?)<\/type>/);
      const yearMatch = videoXml.match(/<year>(.*?)<\/year>/);
      const noteMatch = videoXml.match(/<note>(.*?)<\/note>/);
      
      if (!idMatch || !nameMatch) {
        console.log(`第${index}个视频缺少ID或名称`);
        return null;
      }
      
      const id = idMatch[1].trim();
      const title = nameMatch[1].trim();
      const type = typeMatch ? typeMatch[1].trim() : "unknown";
      const mediaType = (type === 'movie' || title.includes('电影')) ? 'movie' : 'tv';
      
      // 构建详情页URL
      const detailUrl = `${site}/${token}/one_vod?ac=videolist&ids=${id}`;
      
      console.log(`解析到视频: ${title} (ID: ${id}, 类型: ${mediaType})`);
      
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
          mediaType: mediaType
        }
      };
    } catch (e) {
      console.error(`解析第${index}个视频失败:`, e);
      return null;
    }
  }).filter(Boolean);
  
  return items;
}

// --- loadResource函数（关键，必须存在）---
async function loadResource(params) {
  const { seriesName, episode, season, type = 'tv', token, site } = params;
  
  if (!token) {
    console.error("请先在设置中填入token口令");
    return [];
  }
  
  if (!seriesName) {
    console.error("需要提供影片名称");
    return [];
  }
  
  console.log(`loadResource调用: ${seriesName}, 类型: ${type}`);
  
  try {
    // 首先尝试搜索获取结果
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
    
    // 智能匹配最佳结果
    const bestMatch = searchResults[0]; // 先简单取第一个
    console.log(`选择最佳匹配: ${bestMatch.title}`);
    
    // 返回结果 - 注意：这里不获取播放地址，只返回基本信息
    return [{
      name: "ONE源",
      description: `${bestMatch.title} - 点击查看详情`,
      url: bestMatch.ext.detailUrl, // 详情页URL
      ext: {
        detailUrl: bestMatch.ext.detailUrl,
        title: bestMatch.title,
        mediaType: bestMatch.ext.mediaType || 'tv',
        // 添加智能匹配信息
        seriesName: seriesName,
        season: season,
        episode: episode,
        type: type
      }
    }];
    
  } catch (error) {
    console.error(`loadResource失败: ${error.message}`);
    return [];
  }
}

// --- 加载详情（关键修复函数）---
async function loadDetail(url) {
  try {
    console.log("=== loadDetail开始 ===");
    console.log("详情页URL:", url);
    
    // 检查URL格式
    if (!url || !url.includes('one_vod')) {
      console.error("无效的详情页URL");
      return null;
    }
    
    // 获取详情页数据
    const response = await Widget.http.get(url, {
      headers: DEFAULT_HEADERS,
      timeout: 15000
    });
    
    if (!response || !response.data) {
      console.error("详情页返回空数据");
      return null;
    }
    
    console.log("详情页数据长度:", response.data.length);
    
    // 解析详情页XML
    const detailResult = parseDetailXml(response.data);
    
    if (!detailResult) {
      console.error("解析详情页失败");
      return null;
    }
    
    console.log("解析成功，返回详情结果");
    return detailResult;
    
  } catch (error) {
    console.error("加载详情失败:", error);
    console.error("错误堆栈:", error.stack);
    return null;
  }
}

// --- 解析详情页XML（重点修复）---
function parseDetailXml(xmlData) {
  try {
    console.log("=== 开始解析详情XML ===");
    
    // 提取基本信息
    const idMatch = xmlData.match(/<id>(.*?)<\/id>/);
    const nameMatch = xmlData.match(/<name><!\[CDATA\[(.*?)\]\]><\/name>/);
    const typeMatch = xmlData.match(/<type>(.*?)<\/type>/);
    
    const videoId = idMatch ? idMatch[1].trim() : "unknown";
    const videoName = nameMatch ? nameMatch[1].trim() : "未知影片";
    const videoType = typeMatch ? typeMatch[1].trim() : "tv";
    const isMovie = videoType === 'movie';
    
    console.log(`影片信息: ID=${videoId}, 名称=${videoName}, 类型=${videoType}, 是电影=${isMovie}`);
    
    // 查找播放数据 - 更灵活的匹配方式
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
          console.log("找到播放数据，长度:", playData.length);
          break;
        }
      }
    }
    
    if (!playData) {
      console.error("未找到播放数据");
      console.log("XML片段:", xmlData.substring(0, 1000));
      return null;
    }
    
    console.log("播放数据前100字符:", playData.substring(0, 100));
    
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
        console.log("电影播放地址:", episodeData.videoUrl.substring(0, 80) + "...");
      }
    } else {
      // 电视剧格式
      if (episodeData.episodeItems && episodeData.episodeItems.length > 0) {
        result.videoUrl = episodeData.episodeItems[0].videoUrl;
        result.episodeItems = episodeData.episodeItems;
        result.episode = episodeData.episodeItems.length;
        console.log(`电视剧共${episodeData.episodeItems.length}集，第一集地址: ${episodeData.episodeItems[0].videoUrl.substring(0, 80)}...`);
      }
    }
    
    console.log("=== 解析完成 ===");
    return result;
    
  } catch (error) {
    console.error("解析详情XML时出错:", error);
    console.error("错误堆栈:", error.stack);
    return null;
  }
}

// --- 解析播放数据 ---
function parsePlayData(playData, videoId, videoName, isMovie) {
  try {
    console.log("解析播放数据...");
    
    // 清理数据
    let cleanData = playData
      .replace(/\r\n/g, '#')
      .replace(/\n/g, '#')
      .replace(/\r/g, '#');
    
    // 分割剧集
    const episodes = cleanData.split('#').filter(item => {
      return item && item.includes('$') && item.trim().length > 5;
    });
    
    console.log(`分割出 ${episodes.length} 个剧集`);
    
    if (episodes.length === 0) {
      console.error("没有有效的剧集数据");
      return null;
    }
    
    // 电影情况
    if (isMovie || episodes.length === 1) {
      const parts = episodes[0].split('$');
      if (parts.length >= 2) {
        const title = parts[0].trim() || videoName;
        const videoUrl = parts[1].trim();
        
        // 验证URL格式
        if (!isValidVideoUrl(videoUrl)) {
          console.error("无效的视频URL:", videoUrl);
          return null;
        }
        
        console.log("电影解析成功:", title);
        return {
          videoUrl: videoUrl,
          title: title
        };
      }
    }
    
    // 电视剧情况
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
          
          console.log(`剧集 ${i+1}: ${epTitle}`);
        } else {
          console.warn(`剧集 ${i+1} URL无效: ${epUrl.substring(0, 50)}...`);
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
    console.error("解析播放数据失败:", error);
    return null;
  }
}

// --- 验证视频URL是否有效 ---
function isValidVideoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  const urlStr = url.trim().toLowerCase();
  
  // 常见视频格式和协议
  const validPatterns = [
    /^https?:\/\//,  // http/https协议
    /\.m3u8($|\?)/,  // m3u8文件
    /\.mp4($|\?)/,   // mp4文件
    /\.flv($|\?)/,   // flv文件
    /\.ts($|\?)/,    // ts文件
    /rtmp:\/\//,     // rtmp协议
    /rtsp:\/\//      // rtsp协议
  ];
  
  return validPatterns.some(pattern => pattern.test(urlStr));
}

// --- 智能匹配辅助函数（可选）---
function toChineseNum(num) {
  const chars = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  if (num <= 10) return chars[num];
  if (num < 20) return "十" + chars[num % 10];
  return chars[Math.floor(num / 10)] + "十" + (num % 10 === 0 ? "" : chars[num % 10]);
}

function getPreciseMatch(list, params) {
  if (!list?.length) return list[0]; // 简单返回第一个
  
  const { seriesName, season, type } = params;
  const targetSeason = parseInt(season) || 1;
  
  // 这里可以添加您的智能匹配逻辑
  // 暂时简单返回第一个匹配的结果
  
  return list[0];
}
