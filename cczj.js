const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

WidgetMetadata = {
  id: "czzymovie",
  title: "厂长资源",
  icon: "https://assets.vvebo.vip/scripts/icon.png",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  description: "获取厂长资源影片资源",
  author: "Zen",
  site: "https://github.com/zenmic7",
  globalParams: [
    {
      name: "site",
      title: "源站地址",
      type: "input",
      value: "https://www.czzymovie.com"
    }
  ],
  modules: [
    {
      id: "loadResource",
      title: "加载资源",
      functionName: "loadResource",
      type: "stream",
      cacheDuration: 300,
      params: [],
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
      return {};
    }
  }
  return data;
}

// --- 主要功能函数 ---

async function loadResource(params) {
  const { seriesName, episode, season, type = 'tv', site } = params;
  
  if (!seriesName) {
    return [];
  }
  
  try {
    // 1. 搜索影片
    const searchUrl = `https://czzy.xn--m7r412advb92j21st65a.tk/czzysearch.php?wd=${encodeURIComponent(seriesName)}`;
    const searchRes = await Widget.http.get(searchUrl, {
      headers: { 'User-Agent': UA },
      timeout: 10000
    });
    
    // 解析搜索结果
    const resultParts = searchRes.data.split('$$$');
    const searchList = [];
    
    for (const part of resultParts) {
      if (!part.trim()) continue;
      
      const info = part.split('|');
      if (info.length >= 4) {
        searchList.push({
          id: info[0],
          title: info[1],
          cover: info[2],
          remarks: info[3],
          detailUrl: `${site}/movie/${info[0]}.html`
        });
      }
    }
    
    if (searchList.length === 0) {
      return [];
    }
    
    // 2. 找到最佳匹配
    let bestMatch = searchList[0];
    const lowerName = seriesName.toLowerCase();
    
    // 简单匹配逻辑
    for (const item of searchList) {
      const itemTitle = item.title.toLowerCase();
      if (itemTitle === lowerName) {
        bestMatch = item;
        break;
      }
      if (itemTitle.includes(lowerName) || lowerName.includes(itemTitle)) {
        bestMatch = item;
      }
    }
    
    // 3. 获取详情页
    const detailRes = await Widget.http.get(bestMatch.detailUrl, {
      headers: { 'User-Agent': UA },
      timeout: 10000
    });
    
    // 4. 提取播放地址
    const playUrl = extractPlayUrl(detailRes.data, site);
    
    if (!playUrl) {
      return [];
    }
    
    // 5. 返回结果
    return [{
      name: "厂长资源",
      description: `${bestMatch.title}${bestMatch.remarks ? ' - ' + bestMatch.remarks : ''}`,
      url: playUrl
    }];
    
  } catch (error) {
    console.error(`加载资源失败: ${error.message}`);
    return [];
  }
}

async function search(params) {
  const { keyword } = params;
  
  if (!keyword || !keyword.trim()) {
    return [];
  }
  
  try {
    const searchUrl = `https://czzy.xn--m7r412advb92j21st65a.tk/czzysearch.php?wd=${encodeURIComponent(keyword.trim())}`;
    const searchRes = await Widget.http.get(searchUrl, {
      headers: { 'User-Agent': UA },
      timeout: 10000
    });
    
    const resultParts = searchRes.data.split('$$$');
    const results = [];
    
    for (const part of resultParts) {
      if (!part.trim()) continue;
      
      const info = part.split('|');
      if (info.length >= 4) {
        results.push({
          id: info[0],
          title: info[1],
          description: info[3] || "",
          cover: info[2] || "",
          type: "video",
          ext: {
            detailUrl: `https://www.czzymovie.com/movie/${info[0]}.html`
          }
        });
      }
    }
    
    return results;
    
  } catch (error) {
    console.error(`搜索失败: ${error.message}`);
    return [];
  }
}

// --- 提取播放地址的简化版本 ---
function extractPlayUrl(html, site) {
  try {
    // 方法1: 从iframe中提取
    const iframeMatch = html.match(/<iframe[^>]*src=['"]([^'"]+)['"][^>]*>/);
    if (iframeMatch) {
      // 尝试从iframe中提取简单格式的播放地址
      const dataMatch = html.match(/"data":"([^"]+)"/);
      if (dataMatch) {
        const encrypted = dataMatch[1].split('').reverse().join('');
        let temp = '';
        for (let i = 0; i < encrypted.length; i += 2) {
          if (i + 1 < encrypted.length) {
            temp += String.fromCharCode(parseInt(encrypted[i] + encrypted[i + 1], 16));
          }
        }
        if (temp.length > 7) {
          const pos = (temp.length - 7) / 2;
          return temp.substring(0, pos) + temp.substring(pos + 7);
        }
      }
    }
    
    // 方法2: 直接查找播放地址
    const urlPatterns = [
      /url\s*:\s*['"](https?:\/\/[^'"]+)['"]/i,
      /src\s*=\s*['"](https?:\/\/[^'"]+\.(?:m3u8|mp4))['"]/i,
      /(https?:\/\/[^\s"']+\.(?:m3u8|mp4)[^\s"']*)/i
    ];
    
    for (const pattern of urlPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
    
  } catch (error) {
    console.error(`提取播放地址失败: ${error.message}`);
    return null;
  }
}
