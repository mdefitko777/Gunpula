// Taiwan 寶可夢MEZASTAR (TC printing): public JSON API used by the official Nuxt site.
import { fetchJson } from "../lib/http.mjs";
import { firstCjkDate, nfkc } from "../lib/util.mjs";

const API = "https://api.pokemonmezastar.com.tw/api/v1";
export const TW_SOURCE = {
  name: "寶可夢MEZASTAR Taiwan official site API",
  url: "https://api.pokemonmezastar.com.tw/api/v1/season/list",
  licence: "© Pokémon/Nintendo/Creatures/GAME FREAK, T-ARTS/MARV, SEGA Taiwan. No stated terms; metadata + hotlinked image URLs only, personal use",
  role: "TC printings: zh-Hant names, front/back images, orientation, legacy and promo tags, release dates",
  region: "TC",
};

export async function fetchTW() {
  const list = await fetchJson(`${API}/season/list`);
  if (list.json.code !== 0 || !Array.isArray(list.json.data)) throw new Error("TW season/list: unexpected payload");
  const seasons = [], rows = [];
  let stale = list.stale;
  for (const s of list.json.data) {
    const d = await fetchJson(`${API}/season/${s.id}`);
    stale ||= d.stale;
    const data = d.json.data || {};
    seasons.push({
      id: s.id,
      title: nfkc(data.title || s.title),
      title_raw: data.title || s.title,
      date: firstCjkDate(data.content || ""),
      pdf: data.card_list_file_url || null,
      url: `https://www.pokemonmezastar.com.tw/cassette/${s.id}`,
    });
    for (const [orientation, key] of [["horizontal", "horizontal_cards"], ["vertical", "vertical_cards"]]) {
      (data[key] || []).forEach((c, i) => {
        rows.push({
          region: "TC",
          page: s.id,
          pos: `${orientation[0]}${i}`,
          serial_raw: c.serial_number,
          serial: nfkc(c.serial_number || ""),
          name: nfkc(c.name || ""),
          img_front: c.image || null,
          img_back: c.back_image || null,
          orientation,
        });
      });
    }
  }
  return { seasons, rows, stale };
}
