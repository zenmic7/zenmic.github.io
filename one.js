const UA = 'Dart/3.3'

WidgetMetadata = {
  "id": "one_vod_pro",
  "title": "ONE+",
  "icon": "https://assets.vvebo.vip/scripts/icon.png",
  "version": "1.0.0",
  "requiredVersion": "0.0.2",
  "description": "获取One付费资源",
  "author": "Zen",
  "site": "https://github.com/zenmic7",
  "detailCacheDuration": 1,
  "globalParams": [
    {
      "name": "token",
      "title": "token",
      "type": "input",
      "value": "",
      "placeholder": "请输入口令"
    },
    {
      "name": "site",
      "title": "源站地址",
      "type": "input",
      "value": "https://vod.infiniteapi.com"
    }
  ],
  "modules": [
    {
      "id": "loadResource",
      "title": "加载资源",
      "functionName": "loadResource",
      "type": "stream",
      "cacheDuration": 600,
      "params": []
    },
    {
      "id": "search",
      "title": "搜索",
      "functionName": "search",
      "type": "search",
      "cacheDuration": 300,
      "params": [
        {
          "name": "keyword",
          "title": "关键词",
          "type": "input",
          "value": ""
        }
      ]
    }
  ]
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

// --- 获取播放地址 ---
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

// --- 主函数：加载资源 ---
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
  
  try {
    // 1. 搜索影片
    const searchUrl = `${site}/${token}/one_vod_json_new?ac=videolist&wd=${encodeURIComponent(seriesName)}`;
    const searchRes = await Widget.http.get(searchUrl, {
      headers: { 'User-Agent': UA },
      timeout: 10000
    });
    
    const searchList = argsify(searchRes.data);
    if (!searchList || searchList.length === 0) {
      console.log(`未找到影片: ${seriesName}`);
      return [];
    }
    
    // 2. 智能匹配最佳结果
    const bestMatch = getPreciseMatch(searchList, { seriesName, season, type });
    if (!bestMatch) {
      console.log(`未找到匹配的影片: ${seriesName}`);
      return [];
    }
    
    // 3. 获取剧集列表
    const detailRes = await Widget.http.get(bestMatch.detailURLString, {
      headers: { 'User-Agent': UA },
      timeout: 10000
    });
    
    const episodes = argsify(detailRes.data);
    if (!episodes || episodes.length === 0) {
      console.log(`影片没有可用的剧集: ${bestMatch.title}`);
      return [];
    }
    
    // 4. 根据类型处理播放地址
    const results = [];
    
    if (type === 'movie') {
      // 电影：直接取第一个播放地址
      const playInfo = await getOneSourcePlayInfo(episodes[0].episodeDetailURL);
      if (playInfo && playInfo.url) {
        results.push({
          name: "One源",
          description: `${bestMatch.title} - 正片`,
          url: playInfo.url
        });
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
        results.push({
          name: "ONE",
          description: `${bestMatch.title} - ${targetEpisode.title}`,
          url: playInfo.url
        });
      }
    }
    
    return results;
    
  } catch (error) {
    console.error(`加载资源失败: ${error.message}`);
    return [];
  }
}

// --- 搜索函数 ---
async function search(params) {
  const { keyword, token, site } = params;
  
  if (!keyword || !keyword.trim()) {
    return [];
  }
  
  if (!token) {
    console.error("请先在设置中填入token口令");
    return [];
  }
  
  try {
    const searchUrl = `${site}/${token}/one_vod_json_new?ac=videolist&wd=${encodeURIComponent(keyword.trim())}`;
    const searchRes = await Widget.http.get(searchUrl, {
      headers: { 'User-Agent': UA },
      timeout: 10000
    });
    
    const searchList = argsify(searchRes.data);
    if (!searchList || searchList.length === 0) {
      return [];
    }
    
    // 转换为Forward期望的搜索卡片格式
    const results = searchList.map(item => ({
      id: String(item.id || Date.now() + Math.random()), // 确保id是字符串且唯一
      title: item.title || "",
      description: item.descriptionText || "",
      cover: item.coverURLString || "",
      type: "video",
      ext: {
        url: item.detailURLString || "",
        detailUrl: item.detailURLString || "",
        title: item.title || ""
      }
    }));
    
    return results;
    
  } catch (error) {
    console.error(`搜索失败: ${error.message}`);
    return [];
  }
}
