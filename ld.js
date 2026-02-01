WidgetMetadata = {
  id: "girigiri_vod_full",
  title: "ギリギリ动漫",
  icon: "https://assets.vvebo.vip/scripts/icon.png",
  version: "1.0.0",
  requiredVersion: "0.0.2",
  description: "ギリギリ动漫在线资源获取",
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
      value: "https://bgm.girigirilove.com",
      placeholders: [
        { title: "主站", value: "https://bgm.girigirilove.com" },
        { title: "备用1", value: "https://girigiri1.com" },
        { title: "备用2", value: "https://girigiri2.com" }
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

const cheerio = createCheerio();

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

// 动漫分类配置
const CATEGORY_CONFIG = {
  2: { name: "日番", url: "/show/2--------{page}---/" },
  3: { name: "美番", url: "/show/3--------{page}---/" },
  21: { name: "剧场版", url: "/show/21--------{page}---/" }
};

// 动漫类型映射
const ANIME_TYPES = {
  'tv': ['TV', '番剧', '新番', '动画', '日番', '美番'],
  'movie': ['剧场版', '电影', '劇場版', '剧场'],
  'ova': ['OVA', 'OAD', '特别篇', 'SP']
};

// 获取请求头
function getHeaders(site) {
  return {
    'Referer': site + '/',
    'Origin': site,
    'User-Agent': UA
  };
}

// base64解码函数
function base64decode(str) {
  var base64DecodeChars = new Array(-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, 62, -1, -1, -1, 63, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, -1, -1, -1, -1, -1, -1, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, -1, -1, -1, -1, -1, -1, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, -1, -1, -1, -1, -1);
  var c1, c2, c3, c4;
  var i, len, out;
  len = str.length;
  i = 0;
  out = "";
  while (i < len) {
    do {
      c1 = base64DecodeChars[str.charCodeAt(i++) & 0xff]
    } while (i < len && c1 == -1);
    if (c1 == -1)
      break;
    do {
      c2 = base64DecodeChars[str.charCodeAt(i++) & 0xff]
    } while (i < len && c2 == -1);
    if (c2 == -1)
      break;
    out += String.fromCharCode((c1 << 2) | ((c2 & 0x30) >> 4));
    do {
      c3 = str.charCodeAt(i++) & 0xff;
      if (c3 == 61)
        return out;
      c3 = base64DecodeChars[c3]
    } while (i < len && c3 == -1);
    if (c3 == -1)
      break;
    out += String.fromCharCode(((c2 & 0XF) << 4) | ((c3 & 0x3C) >> 2));
    do {
      c4 = str.charCodeAt(i++) & 0xff;
      if (c4 == 61)
        return out;
      c4 = base64DecodeChars[c4]
    } while (i < len && c4 == -1);
    if (c4 == -1)
      break;
    out += String.fromCharCode(((c3 & 0x03) << 6) | c4)
  }
  return out;
}

// 数字转中文（支持1-99）
function toChineseNum(num) {
  const chars = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  if (num <= 10) return chars[num];
  if (num < 20) return "十" + chars[num % 10];
  return chars[Math.floor(num / 10)] + "十" + (num % 10 === 0 ? "" : chars[num % 10]);
}

// 提取季数信息（优化动漫专用）
function extractSeasonInfo(seriesName) {
  if (!seriesName) return { baseName: seriesName, seasonNumber: 1 };
  
  // 动漫常见的季数表示方式
  const patterns = [
    // 中文：第一季、第二季
    { regex: /第([一二三四五六七八九十\d]+)[季部]/ },
    // 数字：xxx 2、xxx 第二季
    { regex: /(.+?)(?:第)?(\d+)(?:季|部)?$/ },
    // 英文：S01、Season 2
    { regex: /(.+?)(?:S|Season\s*)(\d+)/i },
    // 罗马数字：I、II、III（通常是剧场版或OVA）
    { regex: /(.+?)\s+(I{1,3}|IV|V|VI{0,3}|IX|X)$/i },
    // 动漫特有的：Final、完结篇、最终章
    { regex: /(.+?)\s+(Final|完结篇|最终章|最终季|完結篇|最終章|最終季)/i }
  ];
  
  for (const pattern of patterns) {
    const match = seriesName.match(pattern.regex);
    if (match) {
      let seasonNum = 1;
      let baseName = match[1].trim();
      
      if (pattern.regex.toString().includes('第([一二三四五六七八九十\\d]+)')) {
        // 中文数字
        const val = match[1];
        const chineseNumMap = {
          '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
          '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
        };
        seasonNum = chineseNumMap[val] || parseInt(val) || 1;
      } else if (pattern.regex.toString().includes('(\\d+)')) {
        // 阿拉伯数字
        seasonNum = parseInt(match[2]) || 1;
      } else if (pattern.regex.toString().includes('(I{1,3}|IV|V|VI{0,3}|IX|X)')) {
        // 罗马数字转阿拉伯数字
        const romanMap = {
          'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
          'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10
        };
        seasonNum = romanMap[match[2].toUpperCase()] || 1;
      } else if (pattern.regex.toString().includes('(Final|完结篇|最终章|最终季)')) {
        // Final/完结篇等特殊标识
        seasonNum = 999; // 表示最终季
      }
      
      return { baseName, seasonNumber: seasonNum };
    }
  }
  
  return { baseName: seriesName.trim(), seasonNumber: 1 };
}

// 动漫名称清洗（专门处理动漫名称）
function cleanAnimeName(name) {
  if (!name) return '';
  
  // 动漫常见后缀和标识
  const animeMarkers = [
    // 画质标识
    'BD', 'HD', '4K', '1080P', '720P', '480P', 'WEB-DL',
    // 语言标识
    '日语', '英语', '中字', '字幕', '简中', '繁中',
    // 版本标识
    'TV版', '剧场版', 'OVA版', 'OAD版', 'SP版',
    // 其他标识
    '无修', '有修', '生肉', '熟肉', '完结', '连载'
  ];
  
  // 创建正则表达式
  const markersRegex = new RegExp(`\\s*[\\[\\]\\(\\)]\\s*(${animeMarkers.join('|')})\\s*[\\[\\]\\(\\)]\\s*`, 'gi');
  
  let cleaned = name
    .replace(/【.*?】|\[.*?\]|\(.*?\)/g, ' ')  // 移除括号内容但保留空格
    .replace(markersRegex, ' ')               // 移除动漫特定标识
    .replace(/\s+/g, ' ')                     // 合并多个空格
    .trim();
  
  // 移除常见的动漫季数后缀
  const seasonPatterns = [
    '第[一二三四五六七八九十\\d]+季',
    'Season\\s*\\d+',
    'S\\d+',
    '\\s+\\d+$'
  ];
  
  seasonPatterns.forEach(pattern => {
    const regex = new RegExp(pattern, 'i');
    cleaned = cleaned.replace(regex, '');
  });
  
  // 移除末尾的年份
  cleaned = cleaned.replace(/\s*\d{4}\s*$/, '');
  
  return cleaned.trim();
}

// 搜索动漫
async function searchAnime(site, keyword, page = 1) {
  try {
    const encodedText = encodeURIComponent(keyword);
    const url = `${site}/search/${encodedText}----------${page}---/`;
    
    const response = await Widget.http.get(url, {
      headers: getHeaders(site)
    });
    
    if (!response.data) return [];
    
    const $ = cheerio.load(response.data);
    const results = [];
    
    // 解析搜索结果
    $('.flex.rel.overflow').each((_, element) => {
      const $el = $(element);
      const href = $el.find('a[target="_blank"]').attr('href');
      const title = $el.find('h3.slide-info-title').text().trim();
      const cover = $el.find('img.gen-movie-img').attr('data-src');
      const remarks = $el.find('.slide-info-remarks.cor5').text().trim();
      
      if (href && title) {
        results.push({
          vod_id: href,
          vod_name: title,
          vod_pic: site + (cover || ''),
          vod_remarks: remarks,
          vod_sub: remarks,
          url: site + href
        });
      }
    });
    
    return results;
  } catch (error) {
    console.error("搜索动漫失败:", error);
    return [];
  }
}

// 获取动漫详情
async function getAnimeDetail(site, animeUrl) {
  try {
    const response = await Widget.http.get(animeUrl, {
      headers: getHeaders(site)
    });
    
    if (!response.data) return null;
    
    const $ = cheerio.load(response.data);
    const result = {
      title: '',
      episodes: [],
      sources: []
    };
    
    // 提取标题
    result.title = $('h1.slide-info-title').text().trim() || '';
    
    // 提取播放源分类
    const sourceNames = [];
    $('a.swiper-slide').each((_, element) => {
      let text = $(element).text();
      let cleanText = text.replace(/[0-9]/g, '').replace(/\s+/g, ' ').trim();
      if (cleanText) {
        sourceNames.push(cleanText);
      }
    });
    
    // 如果没有分类，添加默认
    if (sourceNames.length === 0) {
      sourceNames.push('默认源');
    }
    
    // 提取每个分类的剧集
    $('div.anthology-list-box').each((i, element) => {
      const sourceName = sourceNames[i] || `播放源${i + 1}`;
      const episodes = [];
      
      $(element).find('a.this-link').each((_, item) => {
        const epName = $(item).text().trim();
        const epUrl = $(item).attr('href');
        
        if (epUrl) {
          episodes.push({
            source: sourceName,
            name: epName,
            url: site + epUrl
          });
        }
      });
      
      if (episodes.length > 0) {
        result.episodes.push(...episodes);
        result.sources.push({
          name: sourceName,
          count: episodes.length
        });
      }
    });
    
    return result;
  } catch (error) {
    console.error("获取动漫详情失败:", error);
    return null;
  }
}

// 解密播放地址
async function decryptPlayUrl(site, playPageUrl) {
  try {
    const response = await Widget.http.get(playPageUrl, {
      headers: getHeaders(site)
    });
    
    if (!response.data) return null;
    
    // 提取加密的播放配置
    const match = response.data.match(/player_aaaa=(.+?)<\/script>/);
    if (!match) return null;
    
    const configStr = match[1];
    const config = JSON.parse(configStr);
    
    if (!config.url) return null;
    
    // base64解码
    const decodedUrl = decodeURIComponent(base64decode(config.url));
    
    return decodedUrl;
  } catch (error) {
    console.error("解密播放地址失败:", error);
    return null;
  }
}

// 精确匹配算法（专门为ギリギリ动漫优化）
function getPreciseMatch(list, params) {
  if (!list?.length) return null;

  const { seriesName, season, type } = params;
  const { baseName, seasonNumber } = extractSeasonInfo(seriesName);
  const targetSeason = parseInt(season) || seasonNumber;
  const cnSeason = toChineseNum(targetSeason);
  
  // 动漫类型关键词
  const typeKeywords = ANIME_TYPES[type] || [];
  
  let best = { item: null, score: -1 };

  for (const item of list) {
    const vodName = item.vod_name || '';
    const vodSub = item.vod_sub || '';
    const vodRemarks = item.vod_remarks || '';
    const fullText = `${vodName} ${vodSub} ${vodRemarks}`.toLowerCase();
    
    let score = 0;

    // 1. 基础名称匹配
    const cleanedBase = cleanAnimeName(baseName).toLowerCase();
    const cleanedName = cleanAnimeName(vodName).toLowerCase();
    
    if (cleanedName === cleanedBase) {
      score += 100; // 完全匹配
    } else if (cleanedName.includes(cleanedBase)) {
      score += 80; // 包含匹配
    } else if (cleanedBase.includes(cleanedName)) {
      score += 60; // 被包含匹配
    } else {
      // 部分匹配评分
      const words = cleanedBase.split(/\s+/).filter(w => w.length > 1);
      let wordScore = 0;
      
      words.forEach(word => {
        if (cleanedName.includes(word)) {
          wordScore += 20;
        }
      });
      
      score += wordScore;
    }

    // 2. 季数匹配
    if (targetSeason > 1 && targetSeason < 999) {
      const seasonPatterns = [
        `${targetSeason}`, 
        `第${targetSeason}季`, 
        `第${cnSeason}季`,
        `s${targetSeason.toString().padStart(2, '0')}`,
        `s${targetSeason}`,
        `season ${targetSeason}`
      ];
      
      const hasSeason = seasonPatterns.some(pattern => 
        fullText.includes(pattern.toLowerCase())
      );
      
      if (hasSeason) {
        score += 50;
      }
    } else if (targetSeason === 999) {
      // Final/最终季匹配
      const finalPatterns = ['final', '完结篇', '最终章', '最终季'];
      const hasFinal = finalPatterns.some(pattern => 
        fullText.includes(pattern.toLowerCase())
      );
      
      if (hasFinal) {
        score += 40;
      }
    } else {
      // 第一季：排除其他季的干扰
      const otherSeasonPatterns = [
        '第[二三四五六七八九十]季',
        's[2-9]',
        'season [2-9]',
        '\\s+2$',
        '第二季',
        '第三季'
      ];
      
      const hasOtherSeason = otherSeasonPatterns.some(pattern => {
        const regex = new RegExp(pattern, 'i');
        return regex.test(fullText);
      });
      
      if (!hasOtherSeason) {
        score += 30;
      }
    }

    // 3. 类型匹配
    if (typeKeywords.length > 0) {
      const hasTypeKeyword = typeKeywords.some(keyword => 
        fullText.includes(keyword.toLowerCase())
      );
      if (hasTypeKeyword) {
        score += 20;
      }
    }

    // 4. 备注信息加分（动漫特定的）
    if (vodRemarks.includes('BD') || vodRemarks.includes('1080')) {
      score += 10; // 高质量片源
    }
    
    if (vodRemarks.includes('完结')) {
      score += 5; // 完结作品
    }

    // 5. 年份匹配（如果有年份信息）
    const yearMatch = vodName.match(/\b(19|20)\d{2}\b/);
    if (yearMatch) {
      score += 5;
    }

    if (score > best.score) {
      best = { item, score };
    }
  }

  // 设置匹配阈值（动漫匹配要求更高精度）
  return best.score >= 70 ? best.item : null;
}

// 主函数
async function loadResource(params) {
  const { seriesName, episode, season, type = 'tv', site, multiSource } = params;

  if (multiSource !== "enabled" || !seriesName) {
    console.warn("请在详情资源列表调用");
    return [];
  }

  try {
    // 1. 搜索动漫
    const searchResults = await searchAnime(site, seriesName);
    if (!searchResults.length) return [];

    // 2. 精确匹配
    const matchedAnime = getPreciseMatch(searchResults, { 
      seriesName, 
      season, 
      type 
    });
    
    if (!matchedAnime) return [];

    // 3. 获取详情
    const detail = await getAnimeDetail(site, matchedAnime.url);
    if (!detail || !detail.episodes.length) return [];

    // 4. 过滤剧集
    let targetEpisodes = [];
    
    if (type === 'movie' || type === 'ova') {
      // 电影或OVA：取第一个播放源的第一个剧集（通常是正片）
      const firstSourceEpisodes = detail.episodes.filter(ep => 
        ep.source.includes('正片') || ep.name.includes('正片') || 
        ep.name.includes('剧场') || ep.name.includes('OVA')
      );
      
      targetEpisodes = firstSourceEpisodes.length > 0 
        ? [firstSourceEpisodes[0]]
        : [detail.episodes[0]];
    } else {
      // TV剧集：按集数过滤
      if (episode) {
        const epNum = parseInt(episode);
        
        targetEpisodes = detail.episodes.filter(ep => {
          // 匹配"第X集"、"第X话"格式
          const epMatch = ep.name.match(/第(\d+)(?:\.\d+)?[集話话]/);
          if (epMatch) {
            return parseInt(epMatch[1]) === epNum;
          }
          
          // 匹配纯数字格式
          const numMatch = ep.name.match(/^(\d+)(?:\.\d+)?$/);
          if (numMatch) {
            return parseInt(numMatch[1]) === epNum;
          }
          
          // 匹配"EP X"格式
          const epPattern = ep.name.match(/ep\s*(\d+)/i);
          if (epPattern) {
            return parseInt(epPattern[1]) === epNum;
          }
          
          return false;
        });
      }
      
      // 如果没有匹配到指定集数，取第一集
      if (targetEpisodes.length === 0) {
        targetEpisodes = [detail.episodes[0]];
      }
    }

    // 5. 获取播放地址
    const results = [];
    
    for (const ep of targetEpisodes.slice(0, 5)) { // 最多取5个源
      try {
        const playUrl = await decryptPlayUrl(site, ep.url);
        if (playUrl && playUrl.includes('.m3u8')) {
          // 提取质量信息
          let quality = "HD";
          if (ep.source.includes('1080') || ep.name.includes('1080')) quality = "1080P";
          if (ep.source.includes('720') || ep.name.includes('720')) quality = "720P";
          if (ep.source.includes('4K') || ep.name.includes('4K')) quality = "4K";
          
          results.push({
            name: ep.source || "ギリギリ动漫",
            description: `${matchedAnime.vod_name} - ${ep.name}${matchedAnime.vod_remarks ? ' - ' + matchedAnime.vod_remarks : ''}`,
            url: playUrl,
            quality: quality,
            _ep: ep.name // 用于调试
          });
        }
      } catch (err) {
        console.error(`获取剧集 ${ep.name} 播放地址失败:`, err);
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
