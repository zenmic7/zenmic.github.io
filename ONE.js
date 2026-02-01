const UA = 'Dart/3.3';
const DEFAULT_HEADERS = {
  'Accept-Language': 'zh-CN,zh;q=0.9,zh-TW;q=0.8,en;q=0.7',
  'User-Agent': UA
};

// ========== WidgetMetadata ==========
WidgetMetadata = {
  "id": "one_vod_final",
  "title": "ONE源",
  "icon": "https://assets.vvebo.vip/scripts/icon.png",
  "version": "1.0.0",
  "requiredVersion": "0.0.1",
  "description": "ONE资源 - 搜索不消耗点数\n在Telegram bot @Infinite_SyncNext_bot 中创建账号并获取token",
  "author": "Zen",
  "site": "https://vod.infiniteapi.com",
  "detailCacheDuration": 1,
  "globalParams": [
    {
      "name": "token",
      "title": "Token",
      "type": "input",
      "value": "",
      "placeholders": [
        {
          "title": "Token",
          "value": ""
        }
      ]
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
      "id": "one-source-list",
      "title": "ONE资源",
      "description": "ONE资源",
      "cacheDuration": 3600,
      "requiresWebView": false,
      "functionName": "getOneList",
      "params": [
        {
          "name": "category",
          "title": "分类",
          "description": "视频分类",
          "type": "enumeration",
          "value": "2",
          "enumOptions": [
            {
              "value": "2",
              "title": "推荐"
            },
            {
              "value": "3",
              "title": "电影"
            },
            {
              "value": "4",
              "title": "电视剧"
            },
            {
              "value": "5",
              "title": "综艺"
            },
            {
              "value": "6",
              "title": "动漫"
            },
            {
              "value": "95",
              "title": "体育"
            }
          ]
        },
        {
          "name": "page",
          "title": "页码",
          "type": "page",
          "value": "1"
        }
      ]
    },
    {
      "id": "search",
      "title": "搜索",
      "functionName": "search",
      "type": "search",
      "params": [
        {
          "name": "keyword",
          "title": "关键词",
          "type": "input",
          "value": ""
        },
        {
          "name": "page",
          "title": "页码",
          "type": "page",
          "value": "1"
        }
      ]
    }
  ]
};

// ========== 清洗key：去掉"第x季"与结尾年份 ==========
function normalizeTitleKey(originalKey) {
  let cleaned = (originalKey || "").toString();
  cleaned = cleaned.replace(/\([^)]*\)/g, "");
  cleaned = cleaned.replace(/（[^）]*）/g, "");
  cleaned = cleaned.replace(/第\s*[0-9一二三四五六七八九十百千]+\s*季/g, "");
  cleaned = cleaned.replace(/\s*20\d{2}\s*年?$/g, "");
  cleaned = cleaned.replace(/\s{2,}/g, " ");
  return cleaned.trim();
}

// ========== 基础获取TMDB数据方法 ==========
async function fetchTmdbData(key, mediaType, year) {
  const cleanedKey = normalizeTitleKey(key);
  const tmdbResults = await Widget.tmdb.get(`/search/${mediaType}`, {
    params: {
      query: cleanedKey,
      language: "zh_CN",
      year: year
    }
  });
  return tmdbResults.results;
}

// ========== 搜索函数 ==========
async function search(params = {}) {
  try {
    const token = params.token || "";
    const keyword = params.keyword || "";
    const page = params.page || 1;
    
    if (!token) {
      return [];
    }
    
    const listUrl = `https://vod.infiniteapi.com/${token}/one_vod?wd=${keyword}&ac=videolist&pg=${page}`;
    const listResponse = await Widget.http.get(listUrl, {
      headers: DEFAULT_HEADERS
    });
    
    const listData = listResponse.data;
    if (!listData) {
      return [];
    }

    const videoMatches = listData.match(/<video>([\s\S]*?)<\/video>/g) || [];
    
    const items = await Promise.all(
      videoMatches.map(async (videoXml) => {
        const nameMatch = videoXml.match(/<name><!\[CDATA\[(.*?)\]\]><\/name>/);
        const idMatch = videoXml.match(/<id>(.*?)<\/id>/);
        const picMatch = videoXml.match(/<pic>(.*?)<\/pic>/);
        const typeMatch = videoXml.match(/<type>(.*?)<\/type>/);
        
        if (!idMatch) return null;
        
        const yearMatch = videoXml.match(/<year>(.*?)<\/year>/);
        const title = nameMatch ? nameMatch[1] : "";
        const tmdbDatas = await fetchTmdbData(title, typeMatch[1], yearMatch ? yearMatch[1] : "");
        const tm = tmdbDatas && tmdbDatas[0] ? tmdbDatas[0] : {};

        return {
          id: idMatch[1],
          type: 'link',
          mediaType: typeMatch[1] === 'movie' ? 'movie' : 'tv',
          link: `https://vod.infiniteapi.com/${token}/one_vod?ac=videolist&ids=${idMatch[1]}`,
          title: title,
          description: tm.overview || "",
          releaseDate: tm.release_date || tm.first_air_date || "",
          backdropPath: tm.backdrop_path || (picMatch ? picMatch[1] : ""),
          posterPath: tm.poster_path || (picMatch ? picMatch[1] : ""),
          rating: tm.vote_average || 0
        };
      })
    );
    
    return items.filter(Boolean);

  } catch (error) {
    console.error('获取ONE源列表失败:', error);
    return [];
  }
}

// ========== 获取列表函数 ==========
async function getOneList(params = {}) {
  try {
    const token = params.token || "";
    const category = params.category || '2';
    const page = params.page || 1;
    
    if (!token) {
      return [];
    }

    const listUrl = `https://vod.infiniteapi.com/${token}/one_vod?t=${category}&ac=videolist&pg=${page}`;
    
    const listResponse = await Widget.http.get(listUrl, {
      headers: DEFAULT_HEADERS
    });
    
    if (!listResponse || !listResponse.data) {
      return [];
    }

    const listData = listResponse.data;
    const videoMatches = listData.match(/<video>([\s\S]*?)<\/video>/g) || [];
    
    const items = await Promise.all(
      videoMatches.map(async (videoXml) => {
        const nameMatch = videoXml.match(/<name><!\[CDATA\[(.*?)\]\]><\/name>/);
        const idMatch = videoXml.match(/<id>(.*?)<\/id>/);
        const picMatch = videoXml.match(/<pic>(.*?)<\/pic>/);
        const typeMatch = videoXml.match(/<type>(.*?)<\/type>/);
        
        if (!idMatch) return null;
        
        const yearMatch = videoXml.match(/<year>(.*?)<\/year>/);
        const title = nameMatch ? nameMatch[1] : "";
        const tmdbDatas = await fetchTmdbData(title, typeMatch[1], yearMatch ? yearMatch[1] : "");
        const tm = tmdbDatas && tmdbDatas[0] ? tmdbDatas[0] : {};

        return {
          id: idMatch[1],
          type: 'link',
          mediaType: typeMatch[1] === 'movie' ? 'movie' : 'tv',
          link: `https://vod.infiniteapi.com/${token}/one_vod?ac=videolist&ids=${idMatch[1]}`,
          title: title,
          description: tm.overview || "",
          releaseDate: tm.release_date || tm.first_air_date || "",
          backdropPath: tm.backdrop_path || (picMatch ? picMatch[1] : ""),
          posterPath: tm.poster_path || (picMatch ? picMatch[1] : ""),
          rating: tm.vote_average || 0
        };
      })
    );
    
    return items.filter(Boolean);

  } catch (error) {
    console.error('获取ONE源列表失败:', error);
    return [];
  }
}

// ========== 加载详情函数（Forward自动调用）==========
async function loadDetail(url) {
  try {
    const detailResponse = await Widget.http.get(url, {
      headers: DEFAULT_HEADERS
    });
    
    if (!detailResponse || !detailResponse.data) {
      return null;
    }

    const detailData = detailResponse.data;
    
    // 解析XML格式的播放数据
    const idMatch = detailData.match(/<id>(.*?)<\/id>/);
    const ddMatches = detailData.match(/<dd flag="">\s*<!\[CDATA\[(.*?)\]\]>\s*<\/dd>/g) || [];
    
    if (ddMatches.length === 0) {
      return null;
    }

    const firstMatch = ddMatches[0];
    const contentMatch = firstMatch.match(/<!\[CDATA\[(.*?)\]\]>/);
    
    if (!contentMatch) {
      return null;
    }

    // 先用 # 分割不同的集
    const episodes = contentMatch[1].split('#').filter(ep => ep.trim());
    
    // 判断是单集还是多集
    if (episodes.length === 1) {
      // 单集情况（电影）
      const [title, playUrl] = episodes[0].split('$');
      if (!playUrl) return null;
      
      return {
        id: idMatch ? idMatch[1] : "unknown",
        type: 'detail',
        mediaType: 'movie',
        link: url,
        title: title || 'ONE电影',
        rating: "5",
        playerType: "app",
        videoUrl: playUrl.trim()
      };
    } else {
      // 多集情况（电视剧）
      const episodeItems = episodes.map((episodeString, index) => {
        const [title, playUrl] = episodeString.split('$');
        if (!playUrl) return null;
        
        return {
          id: (idMatch ? idMatch[1] : 'unknown') + '|' + index,
          link: url,
          type: 'detail',
          title: title || `第 ${index + 1} 集`,
          videoUrl: playUrl.trim(),
          mediaType: 'episode'
        };
      }).filter(item => item && item.videoUrl);
      
      if (episodeItems.length === 0) {
        return null;
      }
      
      return {
        id: idMatch ? idMatch[1] : "unknown",
        type: 'detail',
        mediaType: 'tv',
        link: url,
        title: episodeItems[0]?.title || 'ONE剧集',
        videoUrl: episodeItems[0]?.videoUrl,
        episodeItems: episodeItems,
        playerType: "app",
        episode: episodeItems.length
      };
    }

  } catch (error) {
    console.error('加载详情失败:', error);
    return null;
  }
}

// ========== 兼容原loadResource函数（可选）==========
async function loadResource(params) {
  const { seriesName, token, site } = params;
  
  if (!token || !seriesName) {
    return [];
  }
  
  try {
    // 使用search函数获取结果
    const results = await search({
      token: token,
      site: site || "https://vod.infiniteapi.com",
      keyword: seriesName,
      page: 1
    });
    
    if (results.length === 0) {
      return [];
    }
    
    // 转换为loadResource格式
    return results.map(item => ({
      name: "ONE源",
      description: `${item.title} - 点击播放`,
      url: item.link,
      ext: {
        detailUrl: item.link,
        title: item.title,
        mediaType: item.mediaType
      }
    }));
    
  } catch (error) {
    console.error('loadResource失败:', error);
    return [];
  }
}
