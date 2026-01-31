const UA = 'Dart/3.3'

WidgetMetadata = {
  id: "one_vod_source",
  title: "One",
  icon: "https://assets.vvebo.vip/scripts/icon.png",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  description: "One源付费视频源，需要token口令",
  author: "Zen",
  site: "https://github.com/2kuai/ForwardWidgets",
  globalParams: [
    {
      name: "token",
      title: "Token口令",
      type: "input",
      value: "",
      placeholder: "请输入付费token"
    },
    {
      name: "site",
      title: "源站地址",
      type: "input",
      value: "https://vod.infiniteapi.com"
    },
    {
      name: "enableSearch",
      title: "启用搜索",
      type: "enumeration",
      enumOptions: [
        { title: "启用", value: "enabled" },
        { title: "禁用", value: "disabled" }
      ]
    }
  ],
  modules: [
    {
      id: "loadResource",
      title: "加载资源",
      functionName: "loadResource",
      type: "stream",
      cacheDuration: 300,
      params: []
    },
    {
      id: "search",
      title: "搜索",
      functionName: "search",
      type: "stream",
      cacheDuration: 60,
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
      // 如果不是JSON，尝试解析为URL参数格式
      const params = {};
      data.split('&').forEach(pair => {
        const [key, value] = pair.split('=');
        if (key && value) {
          params[key] = decodeURIComponent(value);
        }
      });
      return params;
    }
  }
  return data;
}

function jsonify(data) {
  return typeof data === 'string' ? data : JSON.stringify(data);
}

// --- 主要功能函数 ---

async function loadResource(params) {
  const { seriesName, episode, season, type, token, site } = params;
  
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
      headers: { 'User-Agent': UA }
    });
    
    const searchList = argsify(searchRes.data);
    if (!searchList || searchList.length === 0) {
      console.log(`未找到影片: ${seriesName}`);
      return [];
    }
    
    // 2. 智能匹配最佳结果
    const bestMatch = getBestMatch(searchList, seriesName, season, type);
    if (!bestMatch) {
      console.log(`未找到匹配的影片: ${seriesName}`);
      return [];
    }
    
    // 3. 获取剧集列表
    const detailRes = await Widget.http.get(bestMatch.detailURLString, {
      headers: { 'User-Agent': UA }
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
      const playInfo = await getPlayInfo(episodes[0].episodeDetailURL);
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
      
      const playInfo = await getPlayInfo(targetEpisode.episodeDetailURL);
      if (playInfo && playInfo.url) {
        results.push({
          name: "One源",
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

async function search(params) {
  const { keyword, token, site, enableSearch } = params;
  
  if (enableSearch !== "enabled" || !keyword || !keyword.trim()) {
    return [];
  }
  
  if (!token) {
    console.error("请先在设置中填入token口令");
    return [];
  }
  
  try {
    const searchUrl = `${site}/${token}/one_vod_json_new?ac=videolist&wd=${encodeURIComponent(keyword.trim())}`;
    const searchRes = await Widget.http.get(searchUrl, {
      headers: { 'User-Agent': UA }
    });
    
    const searchList = argsify(searchRes.data);
    if (!searchList || searchList.length === 0) {
      return [];
    }
    
    // 转换为Forward需要的格式
    const results = searchList.map(item => ({
      name: "One源",
      description: `${item.title}${item.descriptionText ? ' - ' + item.descriptionText : ''}`,
      _meta: {
        title: item.title,
        cover: item.coverURLString,
        detailUrl: item.detailURLString
      }
    }));
    
    return results;
    
  } catch (error) {
    console.error(`搜索失败: ${error.message}`);
    return [];
  }
}

// --- 辅助函数 ---

async function getPlayInfo(url) {
  try {
    const res = await Widget.http.get(url, {
      headers: { 'User-Agent': UA }
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

function getBestMatch(list, seriesName, season, type) {
  if (!list || list.length === 0) return null;
  
  // 简单的匹配算法，可以根据需要优化
  const lowerName = seriesName.toLowerCase();
  
  // 1. 完全匹配
  const exactMatch = list.find(item => 
    item.title.toLowerCase() === lowerName
  );
  if (exactMatch) return exactMatch;
  
  // 2. 包含匹配
  const containsMatch = list.find(item => 
    item.title.toLowerCase().includes(lowerName) ||
    lowerName.includes(item.title.toLowerCase())
  );
  if (containsMatch) return containsMatch;
  
  // 3. 尝试处理季数信息
  if (season) {
    const seasonPatterns = [
      `第${season}季`,
      `S${season}`,
      `Season ${season}`
    ];
    
    const seasonMatch = list.find(item => {
      const title = item.title.toLowerCase();
      return seasonPatterns.some(pattern => 
        title.includes(pattern.toLowerCase())
      );
    });
    if (seasonMatch) return seasonMatch;
  }
  
  // 4. 返回第一个结果
  return list[0];
}

// 可选：添加分类获取功能（如果需要）
async function getCategories(params) {
  const { token, site } = params;
  
  if (!token) return [];
  
  try {
    const url = `${site}/${token}/one_plugin?param=`;
    const res = await Widget.http.get(url, {
      headers: { 'User-Agent': UA }
    });
    
    const data = argsify(res.data);
    const pages = data.pages || [];
    
    return pages.map(page => ({
      id: page.url,
      name: page.title,
      url: page.url
    }));
    
  } catch (error) {
    console.error(`获取分类失败: ${error.message}`);
    return [];
  }
}
