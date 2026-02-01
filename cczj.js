const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

WidgetMetadata = {
  id: "czzymovie",
  title: "厂长资源",
  icon: "https://assets.vvebo.vip/scripts/icon.png",
  version: "1.1.0",
  requiredVersion: "0.0.1",
  description: "获取厂长资源影片资源",
  author: "两块",
  site: "https://github.com/2kuai/ForwardWidgets",
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
    
    // 4. 从详情页提取播放页面链接
    const playPageUrl = extractPlayPageUrl(detailRes.data, site);
    
    if (!playPageUrl) {
      return [];
    }
    
    // 5. 从播放页面提取实际播放地址
    const playUrl = await extractRealPlayUrl(playPageUrl, site);
    
    if (!playUrl) {
      return [];
    }
    
    // 6. 返回结果
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

// --- 提取播放页面URL ---
function extractPlayPageUrl(html, site) {
  try {
    // 尝试从播放列表按钮中提取
    const playBtnRegex = /<div[^>]*class="paly_list_btn"[^>]*>([\s\S]*?)<\/div>/;
    const match = html.match(playBtnRegex);
    
    if (match) {
      const linkRegex = /<a[^>]*href="([^"]+)"[^>]*>/;
      const linkMatch = match[1].match(linkRegex);
      
      if (linkMatch && linkMatch[1]) {
        const url = linkMatch[1];
        return url.startsWith('http') ? url : `${site}${url}`;
      }
    }
    
    // 如果没有找到，尝试其他方法
    const urlPatterns = [
      /<a[^>]*href="(https?:\/\/[^"]+v_play[^"]+)"/,
      /<a[^>]*href="(\/v_play[^"]+)"/,
      /iframe[^>]*src="([^"]+)"/
    ];
    
    for (const pattern of urlPatterns) {
      const patternMatch = html.match(pattern);
      if (patternMatch && patternMatch[1]) {
        const url = patternMatch[1];
        return url.startsWith('http') ? url : `${site}${url}`;
      }
    }
    
    return null;
    
  } catch (error) {
    console.error(`提取播放页面URL失败: ${error.message}`);
    return null;
  }
}

// --- 从播放页面提取真实播放地址 ---
async function extractRealPlayUrl(playPageUrl, site) {
  try {
    const playRes = await Widget.http.get(playPageUrl, {
      headers: { 
        'User-Agent': UA,
        'Referer': `${site}/`
      },
      timeout: 10000
    });
    
    // 尝试提取iframe的src
    const iframeRegex = /<iframe[^>]*src="([^"]+)"[^>]*>/;
    const iframeMatch = playRes.data.match(iframeRegex);
    
    if (iframeMatch && iframeMatch[1]) {
      const iframeSrc = iframeMatch[1];
      const iframeUrl = iframeSrc.startsWith('http') ? iframeSrc : `${site}${iframeSrc}`;
      
      // 获取iframe内容
      const iframeRes = await Widget.http.get(iframeUrl, {
        headers: { 
          'User-Agent': UA,
          'Referer': playPageUrl,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 10000
      });
      
      // 尝试提取播放地址
      const playUrl = extractPlayUrlFromIframe(iframeRes.data);
      if (playUrl) {
        return playUrl;
      }
    }
    
    // 如果没有iframe，尝试直接查找
    return extractPlayUrlFromIframe(playRes.data);
    
  } catch (error) {
    console.error(`提取真实播放地址失败: ${error.message}`);
    return null;
  }
}

// --- 从iframe内容中提取播放地址 ---
function extractPlayUrlFromIframe(html) {
  try {
    // 方法1: 查找加密数据
    const dataMatch = html.match(/"data":"([^"]+)"/);
    if (dataMatch) {
      const data = dataMatch[1];
      try {
        // 尝试解码（原脚本中的方法）
        const encrypted = data.split('').reverse().join('');
        let temp = '';
        for (let i = 0; i < encrypted.length; i += 2) {
          if (i + 1 < encrypted.length) {
            const hex = encrypted[i] + encrypted[i + 1];
            const charCode = parseInt(hex, 16);
            if (!isNaN(charCode)) {
              temp += String.fromCharCode(charCode);
            }
          }
        }
        
        if (temp.length > 7) {
          const pos = Math.floor((temp.length - 7) / 2);
          const result = temp.substring(0, pos) + temp.substring(pos + 7);
          
          // 检查是否是有效的URL
          if (result.startsWith('http')) {
            return result;
          }
        }
      } catch (e) {
        console.error('解密失败:', e.message);
      }
    }
    
    // 方法2: 直接查找URL
    const urlPatterns = [
      /url\s*:\s*['"](https?:\/\/[^'"]+)['"]/,
      /src\s*=\s*['"](https?:\/\/[^'"]+\.(?:m3u8|mp4))['"]/,
      /(https?:\/\/[^\s"']+\.(?:m3u8|mp4)[^\s"']*)/,
      /<source[^>]*src="([^"]+)"[^>]*>/,
      /video[^>]*src="([^"]+)"[^>]*>/
    ];
    
    for (const pattern of urlPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    // 方法3: 查找mysvg或artUrl
    const mysvgMatch = html.match(/\bmysvg\b\s*=\s*['"]([^'"]+)['"]/i);
    if (mysvgMatch) {
      return mysvgMatch[1];
    }
    
    const artUrlMatch = html.match(/art\.url\s*=\s*['"]([^'"]+)['"]/i);
    if (artUrlMatch) {
      return artUrlMatch[1];
    }
    
    return null;
    
  } catch (error) {
    console.error(`从iframe提取播放地址失败: ${error.message}`);
    return null;
  }
}
