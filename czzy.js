const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

WidgetMetadata = {
  id: "czzymovie",
  title: "厂长资源",
  icon: "https://assets.vvebo.vip/scripts/icon.png",
  version: "2.0.0",
  requiredVersion: "0.0.2",
  description: "厂长资源影片资源，智能匹配",
  author: "zen",
  site: "https://github.com/zenmic7",
  globalParams: [
    {
      name: "site",
      title: "源站地址",
      type: "input",
      value: "https://www.czzymovie.com"
    },
    {
      name: "searchSite",
      title: "搜索地址",
      type: "input",
      value: "https://czzy.xn--m7r412advb92j21st65a.tk/czzysearch.php"
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

// --- 智能匹配算法 ---
function getPreciseMatch(list, params) {
  if (!list?.length) return null;

  const { seriesName, season, type } = params;
  const targetSeason = parseInt(season) || 1;
  const cnSeason = toChineseNum(targetSeason);
  
  let best = { item: null, score: -1 };

  for (const item of list) {
    const { vod_name, vod_remarks } = item;
    const fullText = `${vod_name} ${vod_remarks || ''}`;
    
    let score = 0;

    // 电影逻辑：名称完全匹配
    if (type === 'movie') {
      if (vod_name === seriesName) {
        score = 100;
      } else if (vod_name.includes(seriesName) || seriesName.includes(vod_name)) {
        score = 50;
      }
    } 
    
    // 剧集逻辑：智能季数匹配
    else if (type === 'tv' || type === 'series') {
      if (targetSeason === 1) {
        // 第一季：名称完全一致，且没有其他季的干扰
        const otherSeasonReg = /第[二三四五六七八九十]季|S0?[2-9]/i;
        const isExactName = (vod_name === seriesName);
        const hasSeasonSuffix = fullText.match(otherSeasonReg);
        
        if (isExactName && !hasSeasonSuffix) {
          score = 90;
        } else if (vod_name.includes(seriesName) && !vod_name.includes(`${seriesName}2`) && !hasSeasonSuffix) {
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
        
        if (seasonReg.test(vod_name)) {
          score = 90;
        } else if (vod_remarks && seasonReg.test(vod_remarks)) {
          score = 80;
        } else if (seasonPatterns.some(p => fullText.includes(p)) && vod_name.includes(seriesName)) {
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

// --- 提取播放地址（核心功能）---
async function extractPlayUrl(detailUrl, site) {
  try {
    const { data } = await Widget.http.get(detailUrl, {
      headers: { 'User-Agent': UA }
    });
    
    let playurl = null;
    
    // 方法1: 从iframe中提取
    const iframeMatch = data.match(/<iframe[^>]*src=['"]([^'"]+)['"][^>]*>/);
    if (iframeMatch && iframeMatch[1]) {
      const iframeUrl = iframeMatch[1].startsWith('http') ? iframeMatch[1] : site + iframeMatch[1];
      
      try {
        const iframeRes = await Widget.http.get(iframeUrl, {
          headers: {
            'User-Agent': UA,
            'Referer': `${site}/`,
            'sec-fetch-dest': 'iframe',
            'sec-fetch-mode': 'navigate'
          }
        });
        
        const iframeHtml = iframeRes.data;
        
        // 尝试多种方式提取
        // 方式1: 匹配mysvg
        const mysvgMatch = iframeHtml.match(/\bmysvg\b\s*=\s*['"]([^'"]+)['"]/i);
        if (mysvgMatch) {
          playurl = mysvgMatch[1];
        }
        
        // 方式2: 匹配artUrl
        const artUrlMatch = iframeHtml.match(/art\.url\s*=\s*['"]([^'"]+)['"]/i);
        if (!playurl && artUrlMatch) {
          playurl = artUrlMatch[1];
        }
        
        // 方式3: 字符串反转方式
        if (!playurl) {
          const dataMatch = iframeHtml.match(/"data":"([^"]+)"/);
          if (dataMatch) {
            const data = dataMatch[1];
            const encrypted = data.split('').reverse().join('');
            let temp = '';
            for (let i = 0; i < encrypted.length; i += 2) {
              temp += String.fromCharCode(parseInt(encrypted[i] + encrypted[i + 1], 16));
            }
            playurl = temp.substring(0, (temp.length - 7) / 2) + temp.substring((temp.length - 7) / 2 + 7);
          }
        }
        
        // 方式4: 匹配url字段
        if (!playurl) {
          const urlMatch = iframeHtml.match(/url\s*:\s*['"]([^'"]+)['"]/i);
          if (urlMatch) {
            playurl = urlMatch[1];
          }
        }
        
      } catch (e) {
        console.error(`提取iframe内容失败: ${e.message}`);
      }
    }
    
    // 方法2: 直接页面中查找播放地址
    if (!playurl) {
      // 查找可能的m3u8或mp4链接
      const urlRegex = /(https?:\/\/[^\s"']+\.(?:m3u8|mp4|flv|avi|mkv)[^\s"']*)/gi;
      const matches = data.match(urlRegex);
      if (matches && matches.length > 0) {
        playurl = matches[0];
      }
    }
    
    return playurl;
    
  } catch (error) {
    console.error(`提取播放地址失败: ${error.message}`);
    return null;
  }
}

// --- 获取剧集列表 ---
async function getTracksList(detailUrl) {
  try {
    const { data } = await Widget.http.get(detailUrl, {
      headers: { 'User-Agent': UA }
    });
    
    const tracks = [];
    // 提取播放列表按钮
    const playListMatch = data.match(/<div[^>]*class="paly_list_btn"[^>]*>([\s\S]*?)<\/div>/);
    if (playListMatch) {
      const buttonRegex = /<a[^>]*href=['"]([^'"]+)['"][^>]*>([^<]+)<\/a>/g;
      let match;
      while ((match = buttonRegex.exec(playListMatch[1])) !== null) {
        tracks.push({
          name: match[2].trim(),
          url: match[1]
        });
      }
    }
    
    // 提取网盘列表
    const panListMatch = data.match(/<div[^>]*class="ypbt_down_list"[^>]*>([\s\S]*?)<\/div>/);
    if (panListMatch) {
      const panRegex = /<a[^>]*href=['"]([^'"]+)['"][^>]*>([^<]+)<\/a>/g;
      let match;
      while ((match = panRegex.exec(panListMatch[1])) !== null) {
        const url = match[1];
        if (/ali|quark|115|uc|pan\.baidu/i.test(url)) {
          tracks.push({
            name: match[2].trim() + ' (网盘)',
            url: url
          });
        }
      }
    }
    
    return tracks;
    
  } catch (error) {
    console.error(`获取剧集列表失败: ${error.message}`);
    return [];
  }
}

// --- 主函数：加载资源 ---
async function loadResource(params) {
  const { seriesName, episode, season, type = 'tv', site } = params;
  
  if (!seriesName) {
    console.error("需要提供影片名称");
    return [];
  }
  
  try {
    // 1. 搜索影片
    const searchUrl = `${params.searchSite || 'https://czzy.xn--m7r412advb92j21st65a.tk/czzysearch.php'}?wd=${encodeURIComponent(seriesName)}`;
    const searchRes = await Widget.http.get(searchUrl, {
      headers: { 'User-Agent': UA },
      timeout: 10000
    });
    
    // 解析搜索结果的特殊格式：$$$分隔
    const resultParts = searchRes.data.split('$$$');
    const searchList = resultParts.map(part => {
      const info = part.split('|');
      if (info.length >= 4) {
        return {
          vod_id: info[0],
          vod_name: info[1],
          vod_pic: info[2],
          vod_remarks: info[3],
          detailUrl: `${site || 'https://www.czzymovie.com'}/movie/${info[0]}.html`
        };
      }
      return null;
    }).filter(Boolean);
    
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
    const tracks = await getTracksList(bestMatch.detailUrl);
    if (tracks.length === 0) {
      console.log(`影片没有可用的剧集: ${bestMatch.vod_name}`);
      return [];
    }
    
    // 4. 根据类型处理播放地址
    const results = [];
    
    if (type === 'movie') {
      // 电影：直接取第一个播放地址
      const playInfo = await extractPlayUrl(tracks[0].url, site);
      if (playInfo) {
        results.push({
          name: "厂长资源",
          description: `${bestMatch.vod_name} - 正片${bestMatch.vod_remarks ? ' - ' + bestMatch.vod_remarks : ''}`,
          url: playInfo
        });
      }
    } else {
      // 剧集：根据集数匹配
      let targetTrack = tracks[0];
      
      if (episode) {
        // 尝试精确匹配集数
        const epNum = parseInt(episode);
        targetTrack = tracks.find(track => {
          const epMatch = track.name.match(/第(\d+)集/);
          return epMatch && parseInt(epMatch[1]) === epNum;
        }) || tracks[0];
      }
      
      const playInfo = await extractPlayUrl(targetTrack.url, site);
      if (playInfo) {
        results.push({
          name: "厂长资源",
          description: `${bestMatch.vod_name} - ${targetTrack.name}${bestMatch.vod_remarks ? ' - ' + bestMatch.vod_remarks : ''}`,
          url: playInfo
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
  const { keyword, site, searchSite } = params;
  
  if (!keyword || !keyword.trim()) {
    return [];
  }
  
  try {
    const searchUrl = `${searchSite || 'https://czzy.xn--m7r412advb92j21st65a.tk/czzysearch.php'}?wd=${encodeURIComponent(keyword.trim())}`;
    const searchRes = await Widget.http.get(searchUrl, {
      headers: { 'User-Agent': UA },
      timeout: 10000
    });
    
    // 解析搜索结果的特殊格式：$$$分隔
    const resultParts = searchRes.data.split('$$$');
    const searchList = resultParts.map(part => {
      const info = part.split('|');
      if (info.length >= 4) {
        return {
          id: info[0],
          title: info[1],
          description: info[3] || "",
          cover: info[2] || "",
          detailUrl: `${site || 'https://www.czzymovie.com'}/movie/${info[0]}.html`
        };
      }
      return null;
    }).filter(Boolean);
    
    if (!searchList || searchList.length === 0) {
      return [];
    }
    
    // 转换为Forward期望的搜索卡片格式
    const results = searchList.map(item => ({
      id: String(item.id || Date.now() + Math.random()),
      title: item.title || "",
      description: item.description || "",
      cover: item.cover || "",
      type: "video",
      ext: {
        detailUrl: item.detailUrl || "",
        title: item.title || ""
      }
    }));
    
    return results;
    
  } catch (error) {
    console.error(`搜索失败: ${error.message}`);
    return [];
  }
}
