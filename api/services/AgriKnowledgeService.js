const knowledge = require('../../shared/agri-knowledge.json');

const imageCache = new Map();
const imageCacheLifetimeMs = 24 * 60 * 60 * 1000;
const permittedImageLicenses = /^(CC BY(?:-SA)?(?:\s|$)|CC0|Public domain)/i;
const imageSearches = {
  crops: knowledge.crops,
  livestock: knowledge.livestock,
  threats: knowledge.threats,
};
const imageAliases = {
  maize: ['corn'],
  'common-beans': ['bean', 'beans'],
  tomato: ['tomatoes'],
  potato: ['potatoes'],
  banana: ['bananas', 'plantain'],
  groundnuts: ['groundnut', 'peanut', 'peanuts'],
  'pearl-millet': ['millet'],
  'finger-millet': ['ragi'],
  'green-grams': ['mung bean', 'mung beans'],
  'sweet-potatoes': ['sweet potato', 'sweet potatoes'],
  'sweet-peppers': ['bell pepper', 'bell peppers', 'capsicum'],
  citrus: ['orange', 'lemon', 'lime'],
  'bee-colony': ['bee', 'bees', 'beehive', 'apiary'],
  fish: ['fish', 'tilapia'],
  cattle: ['cow', 'cows', 'ox', 'oxen', 'bull', 'bulls'],
};
const genericImageWords = new Set(['crop', 'field', 'farm', 'plant', 'plants', 'fruit', 'tree', 'trees', 'animal', 'livestock', 'poultry', 'herd', 'flock', 'photo', 'tanzania', 'common']);
const cropImageExclusions = new Set(['pest', 'weevil', 'borer', 'armyworm', 'rust', 'disease', 'fungal', 'bacterial', 'virus', 'mite', 'aphid', 'insect', 'caterpillar', 'larva', 'blight', 'rot', 'mildew', 'mould', 'mold', 'lesion', 'symptom', 'infestation', 'bibliography']);
const nonPhotographicImageWords = new Set(['painting', 'paintings', 'artwork', 'portrait', 'drawing', 'illustration', 'engraving', 'etching', 'watercolor', 'watercolour', 'sketch', 'poster', 'map', 'diagram', 'chart', 'sculpture']);
const irrelevantImageWords = new Set(['bridge', 'building', 'house', 'road', 'street', 'sign', 'logo']);
const nonFarmAnimalPhrases = {
  goat: ['mountain goat', 'wild goat'],
  sheep: ['bighorn sheep', 'wild sheep'],
  pig: ['wild boar', 'wild pig'],
  cattle: ['bison', 'wild cattle'],
  chicken: ['junglefowl'],
};

function normalizedWord(value) {
  if (value.endsWith('ies') && value.length > 4) return `${value.slice(0, -3)}y`;
  if (value.endsWith('es') && value.length > 4) return value.slice(0, -2);
  if (value.endsWith('s') && value.length > 4) return value.slice(0, -1);
  return value;
}

function isRelevantImage(page, record) {
  const metadata = page.imageinfo?.[0]?.extmetadata || {};
  const categories = stripHtml(metadata.Categories?.value || '').toLowerCase();
  if (/\b(?:paintings?|drawings?|engravings?|illustrations?|etchings?|sculptures?|artworks?)\b/.test(categories)) return false;
  const text = stripHtml(page.title).toLowerCase();
  if ((nonFarmAnimalPhrases[record.id] || []).some((phrase) => text.includes(phrase))) return false;
  const textWords = new Set((text.match(/[a-z0-9]+/g) || []).map(normalizedWord));
  if ([...textWords].some((word) => nonPhotographicImageWords.has(word) || irrelevantImageWords.has(word))) return false;
  if (record.guide && [...textWords].some((word) => cropImageExclusions.has(word))) return false;
  const recordWords = [
    ...record.name.toLowerCase().matchAll(/[a-z0-9]+/g),
  ].map(([word]) => normalizedWord(word))
    .filter((word) => !genericImageWords.has(word) && (word.length >= 4 || word === 'tea'));
  const aliases = (imageAliases[record.id] || []).flatMap((alias) => alias.toLowerCase().match(/[a-z0-9]+/g) || []);
  return [...recordWords, ...aliases.map(normalizedWord)].some((word) => textWords.has(word));
}

function stripHtml(value = '') {
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function checkSource(source) {
  const checkedAt = new Date().toISOString();
  try {
    const response = await fetch(source.url, {
      method: 'GET',
      headers: { 'User-Agent': 'AGRI-NEST-Knowledge-Source-Check/1.0' },
      signal: AbortSignal.timeout(4500),
    });
    if (response.body) await response.body.cancel();
    return {
      id: source.id,
      checked_at: checkedAt,
      available: response.ok,
      http_status: response.status,
      error: response.ok ? '' : `Official source returned HTTP ${response.status}.`,
    };
  } catch (error) {
    return {
      id: source.id,
      checked_at: checkedAt,
      available: false,
      http_status: null,
      error: error.name === 'TimeoutError' || error.name === 'AbortError'
        ? 'Official source did not respond before the check timed out.'
        : 'Official source could not be reached from this server.',
    };
  }
}

async function getCatalog() {
  const sources = await Promise.all(knowledge.sources.map(checkSource));
  const checkedAt = new Date().toISOString();
  return {
    version: knowledge.version,
    notice: knowledge.notice,
    fetched_at: new Date().toISOString(),
    official_sources_checked_at: checkedAt,
    live_government_content_api: false,
    sources: knowledge.sources.map((source) => ({
      ...source,
      status: sources.find((item) => item.id === source.id),
    })),
    crops: knowledge.crops,
    livestock: knowledge.livestock,
    threats: knowledge.threats,
  };
}

function imageMetadata(page, record) {
  if (!isRelevantImage(page, record)) return null;
  const fileName = page.title.replace(/^File:/, '');
  if (!/\.(?:jpe?g|png|webp)$/i.test(fileName)) return null;
  const image = page.imageinfo?.[0];
  if (!image?.thumburl || !image.descriptionurl) return null;
  let thumbnailUrl;
  let descriptionUrl;
  try {
    thumbnailUrl = new URL(image.thumburl);
    descriptionUrl = new URL(image.descriptionurl);
  } catch {
    return null;
  }
  if (thumbnailUrl.protocol !== 'https:' || !['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(thumbnailUrl.hostname)
    || descriptionUrl.protocol !== 'https:' || descriptionUrl.hostname !== 'commons.wikimedia.org') return null;
  const metadata = image.extmetadata || {};
  const license = stripHtml(metadata.LicenseShortName?.value || '');
  if (!permittedImageLicenses.test(license)) return null;
  const author = stripHtml(metadata.Artist?.value || metadata.Credit?.value || '');
  if (!author) return null;
  let licenseUrl = 'https://commons.wikimedia.org/wiki/Commons:Licensing';
  try {
    const candidate = new URL(metadata.LicenseUrl?.value || licenseUrl);
    if (candidate.protocol === 'https:' && ['creativecommons.org', 'commons.wikimedia.org', 'wikimedia.org'].includes(candidate.hostname)) {
      licenseUrl = candidate.toString();
    }
  } catch {
    licenseUrl = 'https://commons.wikimedia.org/wiki/Commons:Licensing';
  }
  return {
    url: thumbnailUrl.toString(),
    page_url: descriptionUrl.toString(),
    author,
    license,
    license_url: licenseUrl,
    title: fileName,
    source: 'Wikimedia Commons',
  };
}

async function getIllustration(record) {
  const cached = imageCache.get(record.id);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const query = encodeURIComponent(record.photoSearch);
  const url = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${query}&gsrnamespace=6&gsrlimit=20&prop=imageinfo&iiprop=url%7Cextmetadata&iiurlwidth=640&format=json`;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AGRI-NEST-Knowledge-Illustrations/1.0' },
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) throw new Error(`Wikimedia Commons returned HTTP ${response.status}.`);
    const result = await response.json();
    const illustration = Object.values(result.query?.pages || {})
      .map((page) => imageMetadata(page, record))
      .find(Boolean);
    const value = illustration
      ? { id: record.id, available: true, image: illustration, error: '' }
      : { id: record.id, available: false, image: null, error: 'No appropriately licensed image with attribution was found.' };
    imageCache.set(record.id, { expiresAt: Date.now() + imageCacheLifetimeMs, value });
    return value;
  } catch (error) {
    const value = {
      id: record.id,
      available: false,
      image: null,
      error: error.name === 'TimeoutError' || error.name === 'AbortError'
        ? 'Image search timed out.'
        : error.message || 'Image search is unavailable.',
    };
    imageCache.set(record.id, { expiresAt: Date.now() + 60 * 1000, value });
    return value;
  }
}

async function getIllustrations(type, id) {
  const records = imageSearches[type];
  if (!records) {
    const error = new Error('invalid_knowledge_image_type');
    error.status = 400;
    throw error;
  }
  const record = records.find((item) => item.id === id);
  if (!record) {
    const error = new Error('knowledge_record_not_found');
    error.status = 404;
    throw error;
  }
  return { type, fetched_at: new Date().toISOString(), illustrations: [await getIllustration(record)] };
}

module.exports = { getCatalog, getIllustrations };
