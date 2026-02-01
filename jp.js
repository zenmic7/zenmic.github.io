// Forward Widget配置
WidgetMetadata = {
    id: "jianpian_source",
    title: "荐片影视源",
    version: "1.0.0",
    requiredVersion: "0.0.1",
    description: "荐片影视资源源，支持电影、电视剧、动漫、综艺、纪录片等",
    author: "Adapted",
    site: "https://ev5356.970xw.com",
    globalParams: [
        {
            name: "imgDomain",
            title: "图片域名（自动获取，无需修改）",
            type: "input",
            value: ""
        }
    ],
    modules: [
        {
            id: "getCategories",
            title: "获取分类",
            functionName: "getCategories",
            type: "stream",
            params: [],
        },
        {
            id: "getVideos",
            title: "获取视频列表",
            functionName: "getVideos",
            type: "stream",
            params: [
                {
                    name: "tid",
                    title: "分类ID",
                    type: "input",
                    required: true
                },
                {
                    name: "pg",
                    title: "页码",
                    type: "input",
                    value: "1"
                }
            ],
        },
        {
            id: "searchVideos",
            title: "搜索视频",
            functionName: "searchVideos",
            type: "stream",
            params: [
                {
                    name: "wd",
                    title: "关键词",
                    type: "input",
                    required: true
                },
                {
                    name: "pg",
                    title: "页码",
                    type: "input",
                    value: "1"
                }
            ],
        },
        {
            id: "getVideoDetail",
            title: "获取视频详情",
            functionName: "getVideoDetail",
            type: "stream",
            params: [
                {
                    name: "id",
                    title: "视频ID",
                    type: "input",
                    required: true
                }
            ],
        }
    ],
};

// 站点配置
const JIANPIAN_CONFIG = {
    site: "https://ev5356.970xw.com",
    categories: [
        { type_id: 1, type_name: "电影" },
        { type_id: 2, type_name: "电视剧" },
        { type_id: 3, type_name: "动漫" },
        { type_id: 4, type_name: "综艺" },
        { type_id: 50, type_name: "纪录片" },
        { type_id: 99, type_name: "Netflix" },
        { type_id: "home", type_name: "首页推荐" }
    ]
};

// 获取图片域名
async function getImgDomain() {
    try {
        const { site } = JIANPIAN_CONFIG;
        const response = await Widget.http.get(`${site}/api/appAuthConfig`, { 
            headers: getHeader() 
        });
        if (response && response.data) {
            const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
            if (data && data.data && data.data.imgDomain) {
                let domain = data.data.imgDomain;
                return domain.startsWith('http') ? domain : 'https://' + domain;
            }
        }
    } catch (error) {
        console.error("获取图片域名失败:", error);
    }
    return "https://default.img.domain"; // 默认值
}

// 获取请求头
function getHeader() {
    return {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 9; V2196A Build/PQ3A.190705.08211809; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Mobile Safari/537.36;webank/h5face;webank/1.0;netType:NETWORK_WIFI;appVersion:416;packageName:com.jp3.xg3',
        'Referer': JIANPIAN_CONFIG.site,
    };
}

// 1. 获取分类
async function getCategories() {
    return JIANPIAN_CONFIG.categories.map(cat => ({
        type_id: cat.type_id,
        type_name: cat.type_name
    }));
}

// 2. 获取视频列表
async function getVideos(params) {
    const { tid, pg = 1 } = params;
    const { site } = JIANPIAN_CONFIG;
    const imgDomain = await getImgDomain();
    const videos = [];
    
    try {
        if (tid === "home") {
            // 首页推荐
            if (pg > 1) return [];
            const url = `${site}/api/slide/list?pos_id=88`;
            const response = await Widget.http.get(url, { headers: getHeader() });
            const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
            
            if (data && data.data) {
                data.data.forEach(item => {
                    videos.push({
                        vod_id: item.jump_id.toString(),
                        vod_name: item.title,
                        vod_pic: imgDomain + item.thumbnail,
                        vod_remarks: "",
                        vod_blurb: item.description || "",
                        type_id: "home",
                        type_name: "首页推荐"
                    });
                });
            }
        } else if (tid == 99 || tid == 50) {
            // 纪录片和Netflix特殊处理
            if (pg > 1) return [];
            const url = `${site}/api/dyTag/list?category_id=${tid}&page=${pg}`;
            const response = await Widget.http.get(url, { headers: getHeader() });
            const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
            
            if (data && data.data) {
                data.data.forEach(category => {
                    const duration = category.name;
                    category.dataList.forEach(item => {
                        videos.push({
                            vod_id: item.id.toString(),
                            vod_name: item.title,
                            vod_pic: imgDomain + item.path,
                            vod_remarks: item.mask || "",
                            vod_blurb: duration || "",
                            type_id: tid.toString(),
                            type_name: JIANPIAN_CONFIG.categories.find(c => c.type_id == tid)?.type_name || ""
                        });
                    });
                });
            }
        } else {
            // 常规分类
            const url = `${site}/api/crumb/list?fcate_pid=${tid}&area=0&year=0&type=0&sort=updata&page=${pg}&category_id=`;
            const response = await Widget.http.get(url, { headers: getHeader() });
            const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
            
            if (data && data.data) {
                data.data.forEach(item => {
                    videos.push({
                        vod_id: item.id.toString(),
                        vod_name: item.title,
                        vod_pic: imgDomain + item.path,
                        vod_remarks: item.mask || "",
                        vod_blurb: item.description || "",
                        type_id: tid.toString(),
                        type_name: JIANPIAN_CONFIG.categories.find(c => c.type_id == tid)?.type_name || ""
                    });
                });
            }
        }
    } catch (error) {
        console.error("获取视频列表失败:", error);
    }
    
    return videos;
}

// 3. 搜索视频
async function searchVideos(params) {
    const { wd, pg = 1 } = params;
    const { site } = JIANPIAN_CONFIG;
    const imgDomain = await getImgDomain();
    const videos = [];
    
    try {
        const text = encodeURIComponent(wd);
        const url = `${site}/api/v2/search/videoV2?key=${text}&category_id=88&page=${pg}&pageSize=20`;
        const response = await Widget.http.get(url, { headers: getHeader() });
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        
        if (data && data.data) {
            data.data.forEach(item => {
                videos.push({
                    vod_id: item.id.toString(),
                    vod_name: item.title,
                    vod_pic: imgDomain + item.thumbnail,
                    vod_remarks: item.mask || "",
                    vod_blurb: item.description || "",
                    type_id: "",
                    type_name: "搜索结果"
                });
            });
        }
    } catch (error) {
        console.error("搜索视频失败:", error);
    }
    
    return videos;
}

// 4. 获取视频详情
async function getVideoDetail(params) {
    const { id } = params;
    const { site } = JIANPIAN_CONFIG;
    const imgDomain = await getImgDomain();
    const result = {
        list: [],
        play_from: [],
        play_url: []
    };
    
    try {
        const url = `${site}/api/video/detailv2?id=${id}`;
        const response = await Widget.http.get(url, { headers: getHeader() });
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        
        if (data && data.data) {
            const detail = data.data;
            
            // 视频基本信息
            result.list.push({
                vod_id: detail.id.toString(),
                vod_name: detail.title || "",
                vod_pic: imgDomain + (detail.thumbnail || detail.path || ""),
                vod_remarks: detail.mask || "",
                vod_blurb: detail.description || "",
                vod_content: detail.intro || "",
                vod_year: detail.year || "",
                vod_area: detail.area || "",
                vod_actor: detail.actors || "",
                vod_director: detail.director || "",
                vod_lang: detail.lang || ""
            });
            
            // 播放源
            if (detail.source_list_source && Array.isArray(detail.source_list_source)) {
                const playFrom = [];
                const playUrl = [];
                
                detail.source_list_source.forEach(source => {
                    if (source.source_key === 'back_source_list_p2p') return;
                    
                    const sourceName = source.name || "播放源";
                    playFrom.push(sourceName);
                    
                    const episodes = [];
                    if (source.source_list && Array.isArray(source.source_list)) {
                        source.source_list.forEach((item, index) => {
                            episodes.push(`${item.source_name || `第${index+1}集`}$${item.url}`);
                        });
                    }
                    playUrl.push(episodes.join('#'));
                });
                
                result.play_from = playFrom.join('$$$');
                result.play_url = playUrl.join('$$$');
            }
        }
    } catch (error) {
        console.error("获取视频详情失败:", error);
    }
    
    return result;
}

// 兼容旧版本Forward的入口函数
async function loadResource(params) {
    const { tid, pg = 1, wd } = params;
    
    if (wd) {
        return await searchVideos({ wd, pg });
    } else if (tid) {
        return await getVideos({ tid, pg });
    } else {
        return await getCategories();
    }
}
