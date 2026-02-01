WidgetMetadata = {
  id: "jianpian_vod_full",
  title: "荐片",
  icon: "https://assets.vvebo.vip/scripts/icon.png",
  version: "1.0.0",
  requiredVersion: "0.0.2",
  description: "荐片影视在线资源获取",
  author: "Zen",
  site: "https://github.com/zenmic7",
  globalParams: [
    {
      name: "multiSource",
      title: "是否启用聚合搜索",
      type: "enumeration",
      enumOptions: [
        { title: "启用", value: "enabled" },
        { title: "禁用", value: "disabled" }
      ]
    },
    {
      name: "site",
      title: "网站地址",
      type: "input",
      value: "https://ev5356.970xw.com",
      placeholders: [
        { title: "ev5356", value: "https://ev5356.970xw.com" },
        { title: "备用1", value: "https://ev5357.970xw.com" },
        { title: "备用2", value: "https://ev5358.970xw.com" }
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
    }
  ],
};

const UA = 'Mozilla/5.0 (Linux; Android 9; V2196A Build/PQ3A.190705.08211809; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Mobile Safari/537.36;webank/h5face;webank/1.0;netType:NETWORK_WIFI;appVersion:416;packageName:com.jp3.xg3';

// 缓存图片域名
let imgDomainCache = null;

// 获取图片域名
async function getImgDomain(site) {
  if (imgDomainCache) return imgDomainCache;
  
  try {
    const url = `${site}/api/appAuthConfig`;
    const response = await Widget.http.get(url, { headers: getHeader(site) });
    const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    
    if (data && data.data && data.data.imgDomain) {
      let domain = data.data.imgDomain;
      imgDomainCache = domain.startsWith('http') ? domain : 'https://' + domain;
      return imgDomainCache;
    }
  } catch (error) {
    console.error("获取图片域名失败:", error);
  }
  
  return site;
}

function getHeader(site) {
  return {
    'User-Agent': UA,
    'Referer': site,
  };
}

// 数字转中文（支持1-99）
function toChineseNum(num) {
  const chars = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  if (num <= 10) return chars[num];
  if (num < 20) return "十" + chars[num % 10];
  return chars[Math.floor(num / 10)] + "十" + (num % 10 === 0 ? "" : chars[num % 10]);
}

async function searchByKeyword(site, keyword, page = 1) {
  try {
    const encodedWd = encodeURIComponent(keyword);
    const url = `${site}/api/v2/search/videoV2?key=${encodedWd}&category_id=88&page=${page}&pageSize=20`;
    const response = await Widget.http.get(url, { headers: getHeader(site) });
    const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    
    return data?.data || [];
  } catch (error) {
    console.error("搜索失败:", error);
    return [];
  }
}

function extractSeasonInfo(seriesName) {
  if (!seriesName) return { baseName: seriesName, seasonNumber: 1 };
  
  const chineseMatch = seriesName.match(/第([一二三四五六七八九十\d]+)[季部]/);
  if (chineseMatch) {
    const val = chineseMatch[1];
    const chineseNumMap = {
      '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
      '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
    };
    const seasonNum = chineseNumMap[val] || parseInt(val) || 1;
    const baseName = seriesName.replace(/第[一二三四五六七八九十\d]+[季部]/, '').trim();
    return { baseName, seasonNumber: seasonNum };
  }
  
  const digitMatch = seriesName.match(/(.+?)(\d+)$/);
  if (digitMatch) {
    return { baseName: digitMatch[1].trim(), seasonNumber: parseInt(digitMatch[2]) || 1 };
  }
  
  return { baseName: seriesName.trim(), seasonNumber: 1 };
}

function getPreciseMatch(list, params, imgDomain) {
  if (!list?.length) return null;

  const { seriesName, season, type } = params;
  const { baseName, seasonNumber } = extractSeasonInfo(seriesName);
  const targetSeason = parseInt(season) || seasonNumber;
  const cnSeason = toChineseNum(targetSeason);
  
  let best = { item: null, score: -1 };

  for (const item of list) {
    const { title: vodName, id: vodId, mask: vodRemarks, path, thumbnail } = item;
    let score = 0;

    // 基础名称匹配
    if (vodName.includes(baseName)) {
      score += 50;
    } else if (baseName.includes(vodName)) {
      score += 30;
    }

    // 季数匹配
    if (targetSeason > 1) {
      const seasonPatterns = [
        `${targetSeason}`, 
        `第${targetSeason}季`, 
        `第${cnSeason}季`,
        `S${targetSeason.toString().padStart(2, '0')}`,
        `S${targetSeason}`
      ];
      
      const seasonReg = new RegExp(`(${seasonPatterns.join('|')})`, 'i');
      if (seasonReg.test(vodName)) {
        score += 40;
      }
    } else {
      // 第一季：排除其他季的干扰
      const otherSeasonReg = /第[二三四五六七八九十]季|S0?[2-9]/i;
      if (!otherSeasonReg.test(vodName)) {
        score += 20;
      }
    }

    // 类型判断（通过分类ID或标题特征）
    if (type === 'movie' && vodName.includes('电影')) {
      score += 20;
    } else if (type === 'tv' && (vodName.includes('电视剧') || vodName.includes('剧集'))) {
      score += 20;
    }

    // 构建完整的视频对象
    const fullItem = {
      vodId: vodId.toString(),
      vodName: vodName,
      vodRemarks: vodRemarks || "",
      vodPic: imgDomain + (thumbnail || path || ""),
      vodSub: vodRemarks || ""
    };

    if (score > best.score) {
      best = { item: fullItem, score };
    }
  }

  return best.score >= 60 ? best.item : null;
}

async function getVideoDetail(site, videoId) {
  try {
    const url = `${site}/api/video/detailv2?id=${videoId}`;
    const response = await Widget.http.get(url, { headers: getHeader(site) });
    const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
    
    return data?.data || null;
  } catch (error) {
    console.error("获取详情失败:", error);
    return null;
  }
}

async function loadResource(params) {
  const { seriesName, episode, season, type = 'tv', site, multiSource } = params;

  if (multiSource !== "enabled" || !seriesName) {
    console.warn("请在详情资源列表调用");
    return [];
  }

  try {
    // 获取图片域名
    const imgDomain = await getImgDomain(site);
    
    // 搜索视频
    const searchResults = await searchByKeyword(site, seriesName);
    if (!searchResults.length) return [];

    // 精确匹配
    const drama = getPreciseMatch(searchResults, { seriesName, season, type }, imgDomain);
    if (!drama) return [];

    // 获取视频详情
    const detail = await getVideoDetail(site, drama.vodId);
    if (!detail || !detail.source_list_source) return [];

    // 提取播放源
    const results = [];
    const typeName = type === 'movie' ? 'movie' : 'series';
    
    detail.source_list_source.forEach(source => {
      if (source.source_key === 'back_source_list_p2p') return;
      
      const sourceName = source.name || "播放源";
      
      if (source.source_list && Array.isArray(source.source_list)) {
        source.source_list.forEach((item, index) => {
          // 对于剧集，按集数过滤
          if (type === 'tv' && episode) {
            const epNum = parseInt(episode);
            // 检查是否包含指定集数
            if (item.source_name && item.source_name.includes(`第${epNum}集`)) {
              results.push({
                name: sourceName,
                description: `${drama.vodName} - ${item.source_name || `第${index+1}集`}${drama.vodRemarks ? ' - ' + drama.vodRemarks : ''}`,
                url: item.url,
                quality: item.quality || "HD"
              });
            }
          } else {
            // 对于电影或全部剧集
            results.push({
              name: sourceName,
              description: `${drama.vodName} - ${item.source_name || (type === 'movie' ? '正片' : `第${index+1}集`)}${drama.vodRemarks ? ' - ' + drama.vodRemarks : ''}`,
              url: item.url,
              quality: item.quality || "HD"
            });
          }
        });
      }
    });

    // 如果指定了剧集但没有找到，返回第一个播放源
    if (type === 'tv' && episode && results.length === 0 && detail.source_list_source.length > 0) {
      const firstSource = detail.source_list_source[0];
      if (firstSource.source_list && firstSource.source_list[0]) {
        results.push({
          name: firstSource.name || "播放源",
          description: `${drama.vodName} - 第${episode}集${drama.vodRemarks ? ' - ' + drama.vodRemarks : ''}`,
          url: firstSource.source_list[0].url,
          quality: firstSource.source_list[0].quality || "HD"
        });
      }
    }

    // 去重
    const uniqueResults = [];
    const urlSet = new Set();
    
    results.forEach(item => {
      if (item.url && !urlSet.has(item.url)) {
        urlSet.add(item.url);
        uniqueResults.push(item);
      }
    });

    return uniqueResults;

  } catch (err) {
    console.error(`异常: ${err.message}`);
    return [];
  }
}

function getUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (e) =>
    ('x' === e ? (16 * Math.random()) | 0 : 'r&0x3' | '0x8').toString(16)
  );
}
