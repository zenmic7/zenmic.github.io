WidgetMetadata = {
  id: "aowu_vod_full",
  title: "傲屋动漫",
  icon: "https://assets.vvebo.vip/scripts/icon.png",
  version: "1.0.0",
  requiredVersion: "0.0.2",
  description: "傲屋动漫在线资源获取",
  author: "两块",
  site: "https://github.com/2kuai/ForwardWidgets",
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
      value: "https://www.aowu.tv",
      placeholders: [
        { title: "主站", value: "https://www.aowu.tv" },
        { title: "备用1", value: "https://aowu1.tv" },
        { title: "备用2", value: "https://aowu2.tv" }
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

const CryptoJS = createCryptoJS();
const cheerio = createCheerio();

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

// 动漫类型映射
const ANIME_TYPES = {
  'tv': ['TV', '番剧', '新番', '动画'],
  'movie': ['剧场', '电影', '剧场版', '劇場版'],
  'special': ['OVA', 'OAD', '特别篇', 'SP']
};

// 获取签名参数
function getAowuSignParams(type = 20) {
  const time = Math.round(Date.now() / 1000);
  const key = md5('DS' + time + 'DCC147D11943AF75');
  
  return {
    type: type,
    class: '',
    area: '',
    lang: '',
    version: '',
    state: '',
    letter: '',
    page: 1,
    time: time,
    key: key
  };
}

function md5(text) {
  return CryptoJS.MD5(text).toString();
}

function base64Decode(text) {
  return CryptoJS.enc.Utf8.stringify(CryptoJS.enc.Base64.parse(text));
}

// 数字转中文（支持1-99）
function toChineseNum(num) {
  const chars = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  if (num <= 10) return chars[num];
  if (num < 20) return "十" + chars[num % 10];
  return chars[Math.floor(num / 10)] + "十" + (num % 10 === 0 ? "" : chars[num % 10]);
}

// 提取季数信息
function extractSeasonInfo(seriesName) {
  if (!seriesName) return { baseName: seriesName, seasonNumber: 1 };
  
  // 匹配中文季数：第一季、第二季
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
  
  // 匹配数字季数：xxx2、xxx第二季
  const digitMatch = seriesName.match(/(.+?)(?:第)?(\d+)(?:季|部)?$/);
  if (digitMatch) {
    return { baseName: digitMatch[1].trim(), seasonNumber: parseInt(digitMatch[2]) || 1 };
  }
  
  // 匹配英文季数：S01、Season 2
  const englishMatch = seriesName.match(/(.+?)(?:S|Season\s*)(\d+)/i);
  if (englishMatch) {
    return { baseName: englishMatch[1].trim(), seasonNumber: parseInt(englishMatch[2]) || 1 };
  }
  
  return { baseName: seriesName.trim(), seasonNumber: 1 };
}

// 动漫名称清洗
function cleanAnimeName(name) {
  if (!name) return '';
  
  // 移除常见后缀
  let cleaned = name
    .replace(/\(.*?\)|\[.*?\]/g, '')  // 移除括号内容
    .replace(/【.*?】/g, '')          // 移除中文括号
    .replace(/\s+/g, ' ')             // 合并多个空格
    .trim();
  
  // 移除常见的动漫标识
  const commonSuffixes = [
    'TV', 'OVA', 'OAD', '剧场版', '劇場版', '特别篇', 'SP',
    '动画', '动漫', '番剧', '新番', '第一季', '第二季'
  ];
  
  commonSuffixes.forEach(suffix => {
    const regex = new RegExp(`\\s*${suffix}\\s*$`, 'i');
    cleaned = cleaned.replace(regex, '');
  });
  
  return cleaned.trim();
}

// 搜索动漫
async function searchAnime(site, keyword, page = 1) {
  try {
    if (page > 1) return []; // 傲屋搜索只支持第一页
    
    const encodedWd = encodeURIComponent(keyword);
    const url = `${site}/search/-------------.html?wd=${encodedWd}`;
    
    const response = await Widget.http.get(url, {
      headers: { 'User-Agent': UA }
    });
    
    if (!response.data) return [];
    
    const $ = cheerio.load(response.data);
    const results = [];
    
    // 解析搜索结果
    $('.vod-detail').each((_, element) => {
      const $el = $(element);
      const href = $el.find('.detail-info > a').attr('href');
      const title = $el.find('.detail-pic img').attr('alt') || '';
      const cover = $el.find('.detail-pic img').attr('data-src') || '';
      const subTitle = $el.find('.slide-info-remarks.cor5').text() || '';
      
      if (href && title) {
        results.push({
          vod_id: href,
          vod_name: title,
          vod_pic: cover,
          vod_remarks: subTitle,
          vod_sub: subTitle,
          url: `${site}${href}`
        });
      }
    });
    
    return results;
  } catch (error) {
    console.error("搜索动漫失败:", error);
    return [];
  }
}

// 精确匹配算法
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
    const fullText = `${vodName} ${vodSub} ${vodRemarks}`;
    
    let score = 0;

    // 1. 基础名称匹配（最重要）
    const cleanedBase = cleanAnimeName(baseName);
    const cleanedName = cleanAnimeName(vodName);
    
    if (cleanedName === cleanedBase) {
      score += 100;
    } else if (cleanedName.includes(cleanedBase)) {
      score += 70;
    } else if (cleanedBase.includes(cleanedName)) {
      score += 50;
    } else {
      // 名称相似度评分
      const similarity = calculateSimilarity(cleanedBase, cleanedName);
      score += Math.floor(similarity * 40);
    }

    // 2. 季数匹配
    if (targetSeason > 1) {
      const seasonPatterns = [
        `${targetSeason}`, 
        `第${targetSeason}季`, 
        `第${cnSeason}季`,
        `S${targetSeason.toString().padStart(2, '0')}`,
        `S${targetSeason}`,
        `Season ${targetSeason}`
      ];
      
      const seasonReg = new RegExp(`(${seasonPatterns.join('|')})`, 'i');
      if (seasonReg.test(fullText)) {
        score += 40;
      }
    } else {
      // 第一季：排除其他季的干扰
      const otherSeasonReg = /第[二三四五六七八九十]季|S0?[2-9]/i;
      if (!otherSeasonReg.test(fullText)) {
        score += 20;
      }
    }

    // 3. 类型匹配
    if (typeKeywords.length > 0) {
      const hasTypeKeyword = typeKeywords.some(keyword => 
        fullText.includes(keyword)
      );
      if (hasTypeKeyword) {
        score += 20;
      }
    }

    // 4. 备注信息加分
    if (vodRemarks.includes('完结') || vodRemarks.includes('连载')) {
      score += 10;
    }

    if (score > best.score) {
      best = { item, score };
    }
  }

  // 设置匹配阈值
  return best.score >= 80 ? best.item : null;
}

// 字符串相似度计算
function calculateSimilarity(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const maxLen = Math.max(len1, len2);
  
  if (maxLen === 0) return 0;
  
  // 计算编辑距离
  const distance = levenshteinDistance(str1, str2);
  
  return 1 - (distance / maxLen);
}

// 莱文斯坦距离算法
function levenshteinDistance(a, b) {
  const matrix = [];
  
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

// 获取视频详情
async function getVideoDetail(site, videoUrl) {
  try {
    const response = await Widget.http.get(videoUrl, {
      headers: { 'User-Agent': UA }
    });
    
    if (!response.data) return null;
    
    const $ = cheerio.load(response.data);
    const result = {
      title: '',
      episodes: []
    };
    
    // 提取标题
    result.title = $('.slide-info-title').text() || '';
    
    // 提取播放源
    $('.anthology-list-box').each((i, box) => {
      const $box = $(box);
      const sourceName = $box.find('.anthology-tab .swiper-slide').eq(i).text().trim();
      
      $box.find('li a').each((_, episode) => {
        const $ep = $(episode);
        const epName = $ep.text().trim();
        const epUrl = $ep.attr('href');
        
        if (epUrl) {
          result.episodes.push({
            source: sourceName,
            name: epName,
            url: `${site}${epUrl}`
          });
        }
      });
    });
    
    return result;
  } catch (error) {
    console.error("获取视频详情失败:", error);
    return null;
  }
}

// 解密播放地址
async function decryptPlayUrl(site, playPageUrl) {
  try {
    const response = await Widget.http.get(playPageUrl, {
      headers: { 
        'User-Agent': UA,
        'Referer': site
      }
    });
    
    if (!response.data) return null;
    
    const $ = cheerio.load(response.data);
    
    // 提取加密配置
    const scriptContent = $('script:contains(player_)').html();
    if (!scriptContent) return null;
    
    const configMatch = scriptContent.match(/var player_aaaa=\s*(\{.*?\});/);
    if (!configMatch) return null;
    
    const config = JSON.parse(configMatch[1]);
    let videoUrl = config.url;
    
    // 解密处理
    if (config.encrypt == 2) {
      videoUrl = unescape(base64Decode(videoUrl));
    }
    
    // 调用播放器接口
    const playerUrl = `${site}/player/?url=${videoUrl}`;
    const playerRes = await Widget.http.get(playerUrl, {
      headers: { 
        'User-Agent': UA,
        'Referer': playPageUrl
      }
    });
    
    if (!playerRes.data) return null;
    
    // 提取并解密AES
    const sessionKeyMatch = playerRes.data.match(/const sessionKey\s*=\s*"([^"]+)"/);
    const encryptedUrlMatch = playerRes.data.match(/const encryptedUrl\s*=\s*"([^"]+)"/);
    
    if (sessionKeyMatch && encryptedUrlMatch) {
      const sessionKey = sessionKeyMatch[1];
      const encryptedUrl = encryptedUrlMatch[1];
      
      // AES解密
      try {
        const rawData = CryptoJS.enc.Base64.parse(encryptedUrl);
        const iv = CryptoJS.lib.WordArray.create(rawData.words.slice(0, 4));
        const encrypted = CryptoJS.lib.WordArray.create(rawData.words.slice(4));
        
        const decrypted = CryptoJS.AES.decrypt(
          { ciphertext: encrypted },
          CryptoJS.enc.Utf8.parse(sessionKey),
          {
            iv: iv,
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7
          }
        );
        
        return decrypted.toString(CryptoJS.enc.Utf8);
      } catch (e) {
        console.error("AES解密失败:", e);
      }
    }
    
    return videoUrl;
  } catch (error) {
    console.error("解密播放地址失败:", error);
    return null;
  }
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
    const detail = await getVideoDetail(site, matchedAnime.url);
    if (!detail || !detail.episodes.length) return [];

    // 4. 过滤剧集
    let targetEpisodes = [];
    
    if (type === 'movie') {
      // 电影：取第一个播放源
      targetEpisodes = detail.episodes.filter(ep => 
        ep.source.includes('正片') || ep.name.includes('正片') || ep.source.includes('BD')
      );
      if (targetEpisodes.length === 0) {
        targetEpisodes = [detail.episodes[0]];
      }
    } else {
      // 剧集：按集数过滤
      if (episode) {
        const epNum = parseInt(episode);
        targetEpisodes = detail.episodes.filter(ep => {
          // 匹配"第X集"格式
          const epMatch = ep.name.match(/第(\d+)(?:\.\d+)?[集話话]/);
          if (epMatch) {
            return parseInt(epMatch[1]) === epNum;
          }
          
          // 匹配纯数字格式
          const numMatch = ep.name.match(/^(\d+)(?:\.\d+)?$/);
          if (numMatch) {
            return parseInt(numMatch[1]) === epNum;
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
    
    for (const ep of targetEpisodes.slice(0, 3)) { // 最多取3个源
      const playUrl = await decryptPlayUrl(site, ep.url);
      if (playUrl) {
        results.push({
          name: ep.source || "播放源",
          description: `${matchedAnime.vod_name} - ${ep.name}${matchedAnime.vod_remarks ? ' - ' + matchedAnime.vod_remarks : ''}`,
          url: playUrl,
          quality: ep.source.includes('1080') ? "1080P" : 
                  ep.source.includes('720') ? "720P" : 
                  ep.source.includes('4K') ? "4K" : "HD"
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
