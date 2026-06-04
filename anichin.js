const axios = require("axios")
const cheerio = require("cheerio")

class Anichin {
  constructor(baseUrl = "https://anichin.cafe") {
    this.baseUrl = baseUrl.replace(/\/+$/, "")
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        "User-Agent": "Mozilla/5.0 (Node.js) AnichinScraper/1.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      timeout: 15000,
    })
  }

  async _get(path) {
    const url = path && /^https?:\/\//.test(path) ? path : `${this.baseUrl}${path || ""}`
    const res = await this.client.get(url)
    return res.data
  }


  _parseSeriesList($, selector = ".bixbox .listupd article.bs") {
    const items = []

    $(selector).each((i, el) => {
      const a = $(el).find("a").first()
      const href = a.attr("href") || null
      const title = a.find("h2").text().trim() || a.attr("title") || null
      const image = a.find("img").attr("src") || null

      const ep = a.find(".epx").text().trim() || null
      const type = a.find(".typez").text().trim() || null
      let status = a.find(".status").text().trim()
      if (!status) status = a.find(".sb").text().trim() || null
      const description = a.attr("title") || null

      items.push({ title, href, image, ep, type, status, description })
    })

    return items
  }

  _parsePagination($) {
    let next_page = null
    let prev_page = null
    let current_page = null
    let total_pages = null

    $(".pagination .current, .wp-pagenavi .current, .nav-links .current").each((i, el) => {
      const num = parseInt($(el).text().trim(), 10)
      if (!Number.isNaN(num)) current_page = num
    })

    $(".pagination a, .wp-pagenavi a, .nav-links a, .hpage a").each((i, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim().toLowerCase()
      const href = $(el).attr("href") || null
      const pageNum = parseInt(text, 10)

      if (text.includes("next")) next_page = href
      if (text.includes("prev")) prev_page = href
      if (!Number.isNaN(pageNum)) total_pages = Math.max(total_pages || 0, pageNum)
    })

    return { next_page, prev_page, current_page, total_pages }
  }

  _normalizeEmbedSource(value) {
    if (!value) return null

    let source = String(value).trim()
    if (!source || source === "#") return null

    const iframeMatch = source.match(/<iframe[^>]+src=["']([^"']+)["']/i)
    if (iframeMatch) source = iframeMatch[1]

    if (/^[A-Za-z0-9+/=]+$/.test(source) && source.length > 20) {
      try {
        const decoded = Buffer.from(source, "base64").toString("utf8")
        const decodedIframe = decoded.match(/<iframe[^>]+src=["']([^"']+)["']/i)
        if (decodedIframe) source = decodedIframe[1]
        else if (/^https?:\/\//.test(decoded.trim())) source = decoded.trim()
      } catch (e) {
        // Ignore invalid base64-like values and keep the original source.
      }
    }

    return source || null
  }

  _pushUniqueEmbed(embeds, item) {
    const src = this._normalizeEmbedSource(item.src)
    if (!src || embeds.some((embed) => embed.src === src)) return

    embeds.push({
      name: item.name || null,
      src,
    })
  }

  async SwipperSlide() {
    const html = await this._get("/")
    const $ = cheerio.load(html)
    const items = []

    $("#slidertwo .swiper-slide.item").each((i, el) => {
      const slide = $(el)
      const backdrop = slide.find('.backdrop').attr('style') || '';
      const bg = backdrop.match(/url\(['"]?(.*?)['"]?\)/);
      const image = bg ? bg[1] : null;

      const titleEl = slide.find(".info h2 a")
      const title = titleEl.text().trim() || null
      const url = titleEl.attr("href") || null
      const watch = slide.find(".info a.watch").attr("href") || null

      let desc = slide.find(".info .contenPlot").text().trim()
      if (!desc) desc = slide.find(".info .text").text().trim()
      if (!desc) desc = slide.find(".info > p").text().trim()
      if (desc) desc = desc.replace(/\s+/g, " ").trim()

      items.push({ title, url, watch, image, description: desc || null })
    })

    return items
  }

  async popular() {
    const html = await this._get("/")
    const $ = cheerio.load(html)
    const list = []

    $(".releases.hothome")
      .nextAll(".listupd")
      .first()
      .find("article.bs")
      .each((i, el) => {
        const a = $(el).find("a").first()
        const href = a.attr("href") || null

        const title = a.find("h2").text().trim() || a.attr("title") || null
        const image = a.find("img").attr("src") || null

        const ep = a.find(".epx").text().trim() || null
        const type = a.find(".typez").text().trim() || null

        let status = a.find(".sb").text().trim()
        if (!status) status = a.find(".status").text().trim() || null

        list.push({ title, href, image, ep, type, status })
      })

    return list
  }


  async genres() {
    const html = await this._get("/")
    const $ = cheerio.load(html)
    const items = []

    $("ul.genre li a").each((i, el) => {
      const a = $(el)
      const name = a.text().replace(/\s+/g, " ").trim()
      const href = a.attr("href") || null
      const slug = href ? href.replace(/\/?$/, "").split("/").filter(Boolean).pop() : null

      if (name) items.push({ name, slug, href })
    })

    return items
  }

  async genre(genreSlug, page = 1) {
    const slug = String(genreSlug || "").replace(/^\/+|\/+$/g, "")
    const path = page > 1 ? `/genres/${slug}/page/${page}/` : `/genres/${slug}/`

    const html = await this._get(path)
    const $ = cheerio.load(html)

    const title = $(".bixbox .releases h1 span").first().text().trim() || $(".releases h1 span").first().text().trim() || slug
    const items = this._parseSeriesList($, ".bixbox .listupd article.bs")
    const pagination = this._parsePagination($)

    return { genre: title, slug, page, items, pagination }
  }

  async latest(page = 1) {
    const html = await this._get(page > 1 ? `/page/${page}/` : "/")
    const $ = cheerio.load(html)

    const items = []
    $(".releases.latesthome")
      .nextAll(".listupd")
      .first()
      .find("article.bs")
      .each((i, el) => {
        const a = $(el).find("a").first()
        const href = a.attr("href") || null
        const title = a.find("h2").text().trim() || a.attr("title") || null

        const ep = a.find(".epx").text().trim() || null
        const type = a.find(".typez").text().trim() || null
        const status = a.find(".sb").text().trim() || null

        const image = a.find("img").attr("src") || null
        const desc = a.attr("title") || null

        items.push({ title, href, image, ep, type, status, description: desc })
      })

    let next_page = null
    let prev_page = null

    $(".hpage a, .pagination a, .nav-links a").each((i, el) => {
      const t = $(el).text().toLowerCase()
      const h = $(el).attr("href")
      if (t.includes("next")) next_page = h
      if (t.includes("prev")) prev_page = h
    })

    return { page, items, pagination: { next_page, prev_page } }
  }

  async detail(urlOrSlug) {
    const path = /^https?:\/\//.test(urlOrSlug) ? urlOrSlug : `/seri/${urlOrSlug.replace(/^\/+|\/+$/g, "")}/`

    const html = await this._get(path)
    const $ = cheerio.load(html)

    const title = $(".entry-title").first().text().trim() || null
    const thumb = $(".thumbook img").attr("src") || null

    const alt = $(".alter").text().trim() || null
    const synopsis = $(".synp .entry-content").text().trim() || null

    const info = {}
    $(".infox .spe span").each((i, el) => {
      const txt = $(el).text().replace(/\s+/g, " ").trim()
      const [key, ...rest] = txt.split(":")
      if (key && rest.length > 0) info[key.trim().toLowerCase()] = rest.join(":").trim()
    })

    const tags = []
    $(".bottom.tags a").each((i, el) => {
      tags.push({
        name: $(el).text().trim(),
        href: $(el).attr("href"),
      })
    })

    const episodes = []
    $(".eplister ul li").each((i, el) => {
      const a = $(el).find("a")
      const num = $(el).find(".epl-num").text().trim() || null
      const etitle = $(el).find(".epl-title").text().trim() || null
      const date = $(el).find(".epl-date").text().trim() || null
      episodes.push({
        num,
        etitle,
        href: a.attr("href") || null,
        date,
      })
    })

    return { title, thumb, alt, synopsis, info, tags, episodes }
  }

  async episode(urlOrSlug) {
    const path = /^https?:\/\//.test(urlOrSlug) ? urlOrSlug : `/${urlOrSlug.replace(/^\/+|\/+$/g, "")}/`

    const html = await this._get(path)
    const $ = cheerio.load(html)

    const title = $(".entry-title").text().trim() || null
    const epNum = $('meta[itemprop="episodeNumber"]').attr("content") || title.match(/Episode\s+(\d+)/i)?.[1] || null

    const img = $(".megavid .tb img").attr("src") || $(".thumb img").attr("src") || null

    const embeds = []
    $("#pembed iframe, #embed_holder iframe, .player iframe, .player-embed iframe, .megavid iframe, iframe").each((i, el) => {
      const src = $(el).attr("src") || $(el).attr("data-src")
      const name = $(el).closest(".server, .mirror, .player, .player-embed").find(".name, strong, span").first().text().replace(/\s+/g, " ").trim() || null
      this._pushUniqueEmbed(embeds, { name, src })
    })

    const embedAttributes = ["data-video", "data-src", "data-embed", "data-url", "data-iframe", "value"]
    $(".mirror a, .mirror button, .mirror li, .mirroroption, .server a, .server button, .servers a, .servers button, .player a, .player button, select option").each((i, el) => {
      const node = $(el)
      const name = node.text().replace(/\s+/g, " ").trim() || node.attr("data-name") || node.attr("title") || null

      embedAttributes.forEach((attr) => {
        this._pushUniqueEmbed(embeds, { name, src: node.attr(attr) })
      })
    })

    const embedSrc = embeds[0]?.src || null

    const download = []
    $(".soraurlx").each((i, el) => {
      const q = $(el).find("strong").text().trim() || null
      const links = []
      $(el)
        .find("a")
        .each((j, a) => {
          links.push({ name: $(a).text().trim(), href: $(a).attr("href") })
        })

      download.push({ quality: q, links })
    })

    const related = []
    $(".stylefiv .bsx").each((i, el) => {
      const a = $(el).find("a")
      related.push({
        title: a.attr("title") || a.find("h2").text().trim(),
        href: a.attr("href"),
        image: a.find("img").attr("src"),
      })
    })

    const nav = {
      prev: $('.naveps .nvs a[rel="prev"]').attr("href") || null,
      next: $('.naveps .nvs a[rel="next"]').attr("href") || null,
      allEpisodes: $(".naveps .nvsc a").attr("href") || null,
    }

    return { title, episode: epNum, img, embedSrc, embeds, download, related, nav }
  }

  async search(query, page = 1) {
    const q = encodeURIComponent(query)
    const html = await this._get(page > 1 ? `/page/${page}/?s=${q}` : `/?s=${q}`)
    const $ = cheerio.load(html)

    const results = []

    $(".bixbox .listupd article.bs").each((i, el) => {
      const a = $(el).find("a")

      const title = a.find("h2").text().trim() || a.attr("title") || null
      const href = a.attr("href") || null
      const image = a.find("img").attr("src") || null

      const ep = a.find(".epx").text().trim() || null
      let status = a.find(".status").text().trim()
      if (!status) status = a.find(".sb").text().trim() || null
      const type = a.find(".typez").text().trim() || null
      const desc = a.attr("title") || null

      results.push({ title, href, image, ep, type, status, description: desc })
    })

    let next_page = null
    let prev_page = null

    $(".pagination a, .wp-pagenavi a, .nav-links a").each((i, el) => {
      const t = $(el).text().toLowerCase()
      const h = $(el).attr("href")
      if (t.includes("next")) next_page = h
      if (t.includes("prev")) prev_page = h
    })

    return { query, page, results, pagination: { next_page, prev_page } }
  }

  async ongoing(page = 1) {
    const html = await this._get(page > 1 ? `/ongoing/page/${page}/` : "/ongoing/")
    const $ = cheerio.load(html)

    const items = []
    $(".bixbox .listupd article.bs").each((i, el) => {
      const a = $(el).find("a").first()
      const href = a.attr("href") || null
      const title = a.find("h2").text().trim() || a.attr("title") || null

      const ep = a.find(".epx").text().trim() || null
      const type = a.find(".typez").text().trim() || null
      const status = a.find(".sb").text().trim() || null

      const image = a.find("img").attr("src") || null
      const desc = a.attr("title") || null

      items.push({ title, href, image, ep, type, status, description: desc })
    })

    let next_page = null
    let prev_page = null

    $(".pagination a, .nav-links a").each((i, el) => {
      const t = $(el).text().toLowerCase()
      const h = $(el).attr("href")
      if (t.includes("next")) next_page = h
      if (t.includes("prev")) prev_page = h
    })

    return { page, items, pagination: { next_page, prev_page } }
  }

  async completed(page = 1) {
    const html = await this._get(page > 1 ? `/completed/page/${page}/` : "/completed/")
    const $ = cheerio.load(html)

    const items = []
    $(".bixbox .listupd article.bs").each((i, el) => {
      const a = $(el).find("a").first()
      const href = a.attr("href") || null
      const title = a.find("h2").text().trim() || a.attr("title") || null

      const ep = a.find(".epx").text().trim() || null
      const type = a.find(".typez").text().trim() || null
      const status = a.find(".sb").text().trim() || null

      const image = a.find("img").attr("src") || null
      const desc = a.attr("title") || null

      items.push({ title, href, image, ep, type, status, description: desc })
    })

    let next_page = null
    let prev_page = null

    $(".pagination a, .nav-links a").each((i, el) => {
      const t = $(el).text().toLowerCase()
      const h = $(el).attr("href")
      if (t.includes("next")) next_page = h
      if (t.includes("prev")) prev_page = h
    })

    return { page, items, pagination: { next_page, prev_page } }
  }

  async schedule() {
    const html = await this._get("/schedule/")
    const $ = cheerio.load(html)

    const days = []

    $(".bixbox.schedulepage").each((i, el) => {
      const day = $(el).find(".releases h3 span").text().trim() || null
      const items = []

      $(el)
        .find(".listupd .bsx")
        .each((j, be) => {
          const a = $(be).find("a")

          const title = a.attr("title") || $(be).find(".tt").text().trim() || null
          const href = a.attr("href") || null
          const image = a.find("img").attr("src") || null

          const at = $(be).find(".epx").text().trim() || null
          const sb = $(be).find(".sb").text().trim() || null

          items.push({ title, href, image, at, sb })
        })

      days.push({ day, items })
    })

    return days
  }
}

module.exports = Anichin