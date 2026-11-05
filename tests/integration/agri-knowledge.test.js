const request = require('supertest');
const { expect } = require('chai');
const app = require('../../api/generated/server/nodejs-express/app');
const AuthService = require('../../api/services/AuthService');
const AgriKnowledgeService = require('../../api/services/AgriKnowledgeService');
const knowledge = require('../../shared/agri-knowledge.json');

describe('agricultural knowledge catalog', () => {
  const originalGetSessionUser = AuthService.getSessionUser;
  const originalGetCatalog = AgriKnowledgeService.getCatalog;
  const originalGetIllustrations = AgriKnowledgeService.getIllustrations;
  const testUser = {
    user_id: '00000000-0000-4000-8000-000000000311',
    name: 'Knowledge Test Farmer',
    role: 'smallholder_farmer',
    role_status: 'active',
    is_admin: false,
  };
  const catalogResponse = {
    version: knowledge.version,
    notice: knowledge.notice,
    fetched_at: new Date().toISOString(),
    official_sources_checked_at: new Date().toISOString(),
    live_government_content_api: false,
    sources: knowledge.sources,
    crops: knowledge.crops,
    livestock: knowledge.livestock,
    threats: knowledge.threats,
  };

  beforeEach(() => {
    AuthService.getSessionUser = async (token) => (token === 'knowledge-test-token'
      ? { user: testUser, sessionCreatedAt: new Date(), sessionId: 'knowledge-test-session' }
      : null);
    AgriKnowledgeService.getCatalog = async () => catalogResponse;
    AgriKnowledgeService.getIllustrations = async (type) => ({
      type,
      fetched_at: new Date().toISOString(),
      illustrations: [],
    });
  });

  afterEach(() => {
    AuthService.getSessionUser = originalGetSessionUser;
    AgriKnowledgeService.getCatalog = originalGetCatalog;
    AgriKnowledgeService.getIllustrations = originalGetIllustrations;
  });

  it('covers every crop in the production profile catalog', () => {
    const requiredCropIds = [
      'maize', 'rice', 'wheat', 'sorghum', 'finger-millet', 'pearl-millet', 'barley', 'oats',
      'common-beans', 'soybeans', 'pigeon-peas', 'cowpeas', 'green-grams', 'groundnuts', 'chickpeas',
      'tomato', 'onions', 'potato', 'sweet-potatoes', 'cassava', 'banana', 'cabbage', 'kale',
      'spinach', 'carrots', 'sweet-peppers', 'avocados', 'mangoes', 'citrus', 'sunflower', 'sesame',
      'castor', 'coffee', 'tea', 'cotton', 'cashew', 'sugarcane', 'tobacco', 'sisal', 'pyrethrum', 'timber',
    ];
    const cropIds = new Set(knowledge.crops.map((crop) => crop.id));
    const sourceIds = new Set(knowledge.sources.map((source) => source.id));
    expect(requiredCropIds.filter((id) => !cropIds.has(id))).to.deep.equal([]);
    knowledge.crops.forEach((crop) => {
      expect(crop.photoSearch, `${crop.id} photo query`).to.be.a('string').and.not.empty;
      expect(Object.keys(crop.guide), `${crop.id} guide sections`).to.have.length.at.least(8);
      crop.sourceIds.forEach((id) => expect(sourceIds.has(id), `${crop.id} source ${id}`).to.equal(true));
    });
  });

  it('covers livestock and threat hosts with cited catalog entries', () => {
    const livestockIds = new Set(knowledge.livestock.map((animal) => animal.id));
    const catalogIds = new Set([...knowledge.crops, ...knowledge.livestock].map((record) => record.id));
    const sourceIds = new Set(knowledge.sources.map((source) => source.id));
    expect(['cattle', 'goat', 'sheep', 'chicken', 'duck', 'turkey', 'quail', 'pig', 'rabbit', 'fish', 'bee-colony', 'donkey', 'camel', 'other']
      .filter((id) => !livestockIds.has(id))).to.deep.equal([]);
    knowledge.livestock.forEach((animal) => {
      expect(animal.photoSearch, `${animal.id} photo query`).to.be.a('string').and.not.empty;
      expect(Object.keys(animal.care), `${animal.id} care sections`).to.have.length.at.least(6);
      animal.sourceIds.forEach((id) => expect(sourceIds.has(id), `${animal.id} source ${id}`).to.equal(true));
    });
    knowledge.threats.forEach((threat) => {
      expect(threat.hosts.length, `${threat.id} hosts`).to.be.greaterThan(0);
      threat.hosts.forEach((id) => expect(catalogIds.has(id), `${threat.id} host ${id}`).to.equal(true));
      threat.sourceIds.forEach((id) => expect(sourceIds.has(id), `${threat.id} source ${id}`).to.equal(true));
    });
  });

  it('serves the catalog and image lookup only to authenticated users', async () => {
    const unauthenticated = await request(app).get('/knowledge');
    expect(unauthenticated.status).to.equal(401);

    const catalogResult = await request(app)
      .get('/knowledge')
      .set('Cookie', 'agrinest_session=knowledge-test-token');
    expect(catalogResult.status).to.equal(200);
    expect(catalogResult.body.live_government_content_api).to.equal(false);
    expect(catalogResult.body.crops).to.be.an('array');
    expect(catalogResult.body.livestock).to.be.an('array');

    const imageResult = await request(app)
      .get('/knowledge/images?type=livestock&id=cattle')
      .set('Cookie', 'agrinest_session=knowledge-test-token');
    expect(imageResult.status).to.equal(200);
    expect(imageResult.body.type).to.equal('livestock');
  });

  it('only returns relevant, attributed photo files with approved licenses', async () => {
    AgriKnowledgeService.getIllustrations = originalGetIllustrations;
    const originalFetch = global.fetch;
    const makeImage = (title, url) => ({
      title,
      imageinfo: [{
        thumburl: url,
        descriptionurl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
        extmetadata: {
          LicenseShortName: { value: 'CC BY-SA 4.0' },
          LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' },
          Artist: { value: 'Test Photographer' },
        },
      }],
    });
    global.fetch = async () => new Response(JSON.stringify({
      query: {
        pages: {
          1: makeImage('File:Maize weevil reference.jpg', 'https://upload.wikimedia.org/pest.jpg'),
          2: makeImage('File:Maize field painting.jpg', 'https://upload.wikimedia.org/art.jpg'),
          3: makeImage('File:Maize field photo.jpg', 'https://thumb.wikimedia.org/photo.jpg'),
          4: makeImage('File:Maize field unsafe.jpg', 'https://images.example.com/photo.jpg'),
        },
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    try {
      const result = await AgriKnowledgeService.getIllustrations('crops', 'maize');
      expect(result.illustrations[0].available).to.equal(true);
      expect(result.illustrations[0].image.title).to.equal('Maize field photo.jpg');
      expect(result.illustrations[0].image.author).to.equal('Test Photographer');
      expect(result.illustrations[0].image.license).to.equal('CC BY-SA 4.0');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
